import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { db } from '@ac/db';
import { 
    event, 
    eventTag, 
    tag, 
    eventContact, 
    eventLocation, 
    eventResource, 
    recurringSeries, 
    campaign,
    contact,
    location,
    resource
} from '@ac/db';
import { eq, desc, inArray, ilike, and, sql, gte, lte } from 'drizzle-orm';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { 
    createEventSchema, 
    updateEventSchema, 
    deleteEventSchema, 
    listEventsSchema 
} from '$lib/validations/events';
import { error } from '@sveltejs/kit';
import { parseDateTime, toZoned } from '@internationalized/date';
import { generateEventAssets } from '$lib/server/events/assets';
import { publishEventChange } from '$lib/server/realtime';
import { syncService } from '$lib/server/sync/service';

/**
 * List events with pagination and filters.
 */
export const listEvents = query(listEventsSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'events');

    const { page = 1, limit = 50, search, locationId, tagId, contactId } = input;
    const offset = (page - 1) * limit;

    let baseQuery = db.select({ id: event.id }).from(event);
    const conditions = [];

    if (search) {
        conditions.push(ilike(event.summary, `%${search}%`));
    }

    // Join and filter by associations if provided
    if (locationId) {
        const ids = Array.isArray(locationId) ? locationId : [locationId];
        baseQuery = baseQuery.innerJoin(eventLocation, eq(eventLocation.eventId, event.id)) as any;
        conditions.push(inArray(eventLocation.locationId, ids));
    }

    if (tagId) {
        const ids = Array.isArray(tagId) ? tagId : [tagId];
        baseQuery = baseQuery.innerJoin(eventTag, eq(eventTag.eventId, event.id)) as any;
        conditions.push(inArray(eventTag.tagId, ids));
    }

    if (contactId) {
        const ids = Array.isArray(contactId) ? contactId : [contactId];
        baseQuery = baseQuery.innerJoin(eventContact, eq(eventContact.eventId, event.id)) as any;
        conditions.push(inArray(eventContact.contactId, ids));
    }

    const finalQuery = db.select({ id: event.id }).from(event).where(and(...conditions));
    const countResult = await db.execute(sql`SELECT count(*) FROM (${finalQuery}) AS subquery`);
    const total = Number(countResult.rows[0]?.count || 0);

    if (total === 0) return { data: [], total: 0 };

    const paginatedIds = (await finalQuery.orderBy(desc(event.createdAt)).limit(limit).offset(offset)).map(r => r.id);
    
    if (paginatedIds.length === 0) return { data: [], total };

    const results = await db.query.event.findMany({
        where: inArray(event.id, paginatedIds),
        with: {
            tags: { with: { tag: true } },
            locations: { with: { location: true } },
            resources: { with: { resource: true } },
            contacts: { with: { contact: true } }
        },
        orderBy: desc(event.createdAt)
    });

    return {
        data: (results as any[]).map(row => ({
            ...row,
            id: String(row.id),
            startDateTime: row.startDateTime?.toISOString() || null,
            endDateTime: row.endDateTime?.toISOString() || null,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
            tags: row.tags.map((et: any) => et.tag),
            locations: row.locations.map((el: any) => el.location),
            resources: row.resources.map((er: any) => er.resource),
            contacts: row.contacts.map((ec: any) => ec.contact)
        })),
        total
    };
});

/**
 * Fetch a single event by ID.
 */
export const readEvent = query(v.string(), async (id) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'events');

    const result = await db.query.event.findFirst({
        where: eq(event.id, id),
        with: {
            tags: { with: { tag: true } },
            locations: { with: { location: true } },
            resources: { with: { resource: true } },
            contacts: { with: { contact: { with: { emails: true, phones: true } } } },
            series: true,
            campaign: true
        }
    });

    if (!result) error(404, 'Event not found');

    const data = result as any;

    return {
        ...data,
        id: String(data.id),
        startDateTime: data.startDateTime?.toISOString() || null,
        endDateTime: data.endDateTime?.toISOString() || null,
        createdAt: data.createdAt.toISOString(),
        updatedAt: data.updatedAt.toISOString(),
        tagIds: data.tags.map((et: any) => et.tagId),
        locationIds: data.locations.map((el: any) => el.locationId),
        resourceIds: data.resources.map((er: any) => er.resourceId),
        contactIds: data.contacts.map((ec: any) => ec.contactId),
        recurrence: data.series?.rrule ? [data.series.rrule] : (data.recurrence || []),
        syncIds: data.campaign?.content ? ((data.campaign.content as any).syncIds || []) : [],
        resolvedContact: data.contacts[0]?.contact ? ((c: any) => ({
            name: c.displayName,
            email: c.emails?.find((e: any) => e.isPrimary)?.email || c.emails?.[0]?.email || null,
            phone: c.phones?.find((p: any) => p.isPrimary)?.phone || c.phones?.[0]?.phone || null,
            qrCodeDataUrl: c.qrCodePath
        }))(data.contacts[0].contact) : null,
        resolvedLocation: data.locations[0]?.location ? {
            name: data.locations[0].location.name,
            address: data.locations[0].location.street
        } : null,
        tags: data.tags.map((et: any) => et.tag),
        locations: data.locations.map((el: any) => el.location),
        resources: data.resources.map((er: any) => er.resource),
        contacts: data.contacts.map((ec: any) => ec.contact)
    };
});

/**
 * Create a new event.
 */
export const createEvent = form(createEventSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'events');

    // Date parsing logic
    const start = parseDate(data.startDate, data.startTime, data.startTimeZone || 'UTC');
    const end = data.endDate ? parseDate(data.endDate, data.endTime, data.endTimeZone || data.startTimeZone || 'UTC') : null;

    // Handle Recurrence
    let seriesId: string | null = null;
    let recurrenceRule: string | null = null;
    if (data.recurrence) {
        recurrenceRule = Array.isArray(data.recurrence) ? data.recurrence[0] : data.recurrence;
        const [newSeries] = await db.insert(recurringSeries).values({
            rrule: recurrenceRule,
            anchorDate: start,
            anchorEndDate: end,
            userId: user.id,
        }).returning();
        seriesId = newSeries.id;
    }

    // Create Campaign
    const [newCampaign] = await db.insert(campaign).values({
        userId: user.id,
        name: `Campaign for ${data.summary}`,
        content: { syncIds: Array.isArray(data.syncIds) ? data.syncIds : (data.syncIds ? [data.syncIds] : []) }
    }).returning();

    // Insert Master Event
    const [newEvent] = await db.insert(event).values({
        userId: user.id,
        campaignId: newCampaign.id,
        seriesId,
        summary: data.summary,
        description: data.description || null,
        categoryBerlinDotDe: data.categoryBerlinDotDe || null,
        ticketPrice: data.ticketPrice || null,
        isAllDay: !!data.isAllDay,
        status: data.status || 'confirmed',
        startDateTime: start,
        startTimeZone: data.startTimeZone || null,
        endDateTime: end,
        endTimeZone: data.endTimeZone || null,
        isPublic: !!data.isPublic,
        heroImage: data.heroImage || null,
        guestsCanInviteOthers: !!data.guestsCanInviteOthers,
        guestsCanModify: !!data.guestsCanModify,
        guestsCanSeeOtherGuests: !!data.guestsCanSeeOtherGuests,
    }).returning();

    // Link associations
    await linkAssociations(newEvent.id, data);

    // Expand recurrence if applicable
    const allEventIds = [newEvent.id];
    if (recurrenceRule) {
        const { expandRecurrence } = await import('$lib/server/events/recurrence');
        const instances = expandRecurrence(recurrenceRule, start, end);
        for (const { date, end: instanceEnd } of instances) {
            const instanceId = crypto.randomUUID();
            await db.insert(event).values({
                id: instanceId,
                userId: user.id,
                campaignId: newCampaign.id,
                seriesId,
                summary: data.summary,
                description: data.description || null,
                categoryBerlinDotDe: data.categoryBerlinDotDe || null,
                ticketPrice: data.ticketPrice || null,
                isAllDay: !!data.isAllDay,
                status: data.status || 'confirmed',
                startDateTime: date,
                startTimeZone: data.startTimeZone || null,
                endDateTime: instanceEnd || null,
                endTimeZone: data.endTimeZone || null,
                isPublic: !!data.isPublic,
                heroImage: data.heroImage || null,
                guestsCanInviteOthers: !!data.guestsCanInviteOthers,
                guestsCanModify: !!data.guestsCanModify,
                guestsCanSeeOtherGuests: !!data.guestsCanSeeOtherGuests,
                recurringEventId: newEvent.id,
                originalStartTime: { dateTime: date.toISOString() },
            });
            await linkAssociations(instanceId, data);
            allEventIds.push(instanceId);
        }
    }

    // Assets & Sync
    await generateEventAssets(newEvent.id);
    await publishEventChange('create', allEventIds);
    await syncService.syncItems(user.id, allEventIds, 'event');

    void listEvents().refresh();
    return { success: true, id: newEvent.id };
});

/**
 * Update an existing event.
 */
export const updateEvent = form(updateEventSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'events');

    const { id, ...updateData } = data;
    
    // Fetch current to check ownership
    const current = await db.query.event.findFirst({
        where: eq(event.id, id)
    });
    if (!current) error(404, 'Event not found');

    // Parse dates if provided
    const start = data.startDate ? parseDate(data.startDate, data.startTime, data.startTimeZone || 'UTC') : undefined;
    const end = data.endDate ? parseDate(data.endDate, data.endTime, data.endTimeZone || data.startTimeZone || 'UTC') : undefined;

    // Handle Recurrence Update
    let seriesId = current.seriesId;
    if (data.recurrence) {
        const recurrenceRule = Array.isArray(data.recurrence) ? data.recurrence[0] : data.recurrence;
        if (seriesId) {
            await db.update(recurringSeries).set({
                rrule: recurrenceRule,
                anchorDate: start || current.startDateTime || new Date(),
                anchorEndDate: end || current.endDateTime || null,
            }).where(eq(recurringSeries.id, seriesId));
        } else {
            const [newSeries] = await db.insert(recurringSeries).values({
                rrule: recurrenceRule,
                anchorDate: start || current.startDateTime || new Date(),
                anchorEndDate: end || current.endDateTime || null,
                userId: user.id,
            }).returning();
            seriesId = newSeries.id;
        }
    } else if (data.recurrence === null && seriesId) {
        // If explicitly set to null, remove series association (optional logic)
        seriesId = null;
    }

    await db.update(event).set({
        summary: data.summary,
        description: data.description,
        seriesId,
        startDateTime: start,
        startTimeZone: data.startTimeZone,
        endDateTime: end,
        endTimeZone: data.endTimeZone,
        isAllDay: !!data.isAllDay,
        isPublic: !!data.isPublic,
        status: data.status,
        ticketPrice: data.ticketPrice,
        categoryBerlinDotDe: data.categoryBerlinDotDe,
        heroImage: data.heroImage,
        guestsCanInviteOthers: !!data.guestsCanInviteOthers,
        guestsCanModify: !!data.guestsCanModify,
        guestsCanSeeOtherGuests: !!data.guestsCanSeeOtherGuests,
    }).where(eq(event.id, id));

    // Update campaign sync settings
    if (current.campaignId && data.syncIds) {
        await db.update(campaign).set({
            content: { syncIds: Array.isArray(data.syncIds) ? data.syncIds : [data.syncIds] }
        }).where(eq(campaign.id, current.campaignId));
    }

    // Update associations (simple wipe and reload for now to keep it stable)
    await db.delete(eventTag).where(eq(eventTag.eventId, id));
    await db.delete(eventLocation).where(eq(eventLocation.eventId, id));
    await db.delete(eventResource).where(eq(eventResource.eventId, id));
    await db.delete(eventContact).where(eq(eventContact.eventId, id));
    await linkAssociations(id, data);

    await generateEventAssets(id);
    await publishEventChange('update', [id]);
    await syncService.syncItems(user.id, [id], 'event');

    void readEvent(id).set(await readEvent(id)); // Force update in cache
    void listEvents().refresh();
    return { success: true };
});

/**
 * Delete an event.
 */
export const deleteEvent = command(deleteEventSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'events');

    const { id, deleteAllInSeries } = data;
    
    const target = await db.query.event.findFirst({
        where: eq(event.id, id)
    });
    if (!target) error(404, 'Event not found');

    if (deleteAllInSeries && target.seriesId) {
        const related = await db.select({ id: event.id }).from(event).where(eq(event.seriesId, target.seriesId));
        const ids = related.map(r => r.id);
        
        // Clean up external syncs first
        await syncService.deleteEventMappings(user.id, ids);
        
        await db.delete(event).where(inArray(event.id, ids));
        await db.delete(recurringSeries).where(eq(recurringSeries.id, target.seriesId));
        await publishEventChange('delete', ids);
    } else {
        // Clean up external syncs
        await syncService.deleteEventMappings(user.id, [id]);
        
        await db.delete(event).where(eq(event.id, id));
        await publishEventChange('delete', [id]);
    }

    void listEvents().refresh();
    return { success: true };
});

/**
 * Delete multiple events.
 */
export const deleteEvents = command(v.object({
    ids: v.array(v.string()),
    deleteAllInSeries: v.optional(v.boolean())
}), async (data) => {
    const { ids, deleteAllInSeries } = data;
    const user = getAuthenticatedUser();
    ensureAccess(user, 'events');

    if (deleteAllInSeries && ids.length === 1) {
        const target = await db.query.event.findFirst({
            where: eq(event.id, ids[0])
        });
        if (target?.seriesId) {
            const related = await db.select({ id: event.id }).from(event).where(eq(event.seriesId, target.seriesId));
            const rids = related.map(r => r.id);
            await db.delete(event).where(inArray(event.id, rids));
            await db.delete(recurringSeries).where(eq(recurringSeries.id, target.seriesId));
            await publishEventChange('delete', rids);
        } else {
            await db.delete(event).where(inArray(event.id, ids));
            await publishEventChange('delete', ids);
        }
    } else {
        await db.delete(event).where(inArray(event.id, ids));
        await publishEventChange('delete', ids);
    }
    void listEvents().refresh();
    return { success: true };
});

// --- HELPERS ---

function parseDate(dateStr: string, timeStr?: string, timeZone: string = 'UTC'): Date {
    const dString = timeStr ? `${dateStr}T${timeStr}` : `${dateStr}T00:00:00`;
    const calendarDate = parseDateTime(dString);
    const zonedDate = toZoned(calendarDate, timeZone);
    return zonedDate.toDate();
}

async function linkAssociations(eventId: string, data: any) {
    const tagIds = Array.isArray(data.tagIds) ? data.tagIds : (data.tagIds ? [data.tagIds] : []);
    const locationIds = Array.isArray(data.locationIds) ? data.locationIds : (data.locationIds ? [data.locationIds] : []);
    const resourceIds = Array.isArray(data.resourceIds) ? data.resourceIds : (data.resourceIds ? [data.resourceIds] : []);
    const contactIds = Array.isArray(data.contactIds) ? data.contactIds : (data.contactIds ? [data.contactIds] : []);

    if (tagIds.length > 0) {
        await db.insert(eventTag).values(tagIds.map((tagId: string) => ({ eventId, tagId }))).onConflictDoNothing();
    }
    if (locationIds.length > 0) {
        await db.insert(eventLocation).values(locationIds.map((locationId: string) => ({ eventId, locationId }))).onConflictDoNothing();
    }
    if (resourceIds.length > 0) {
        await db.insert(eventResource).values(resourceIds.map((resourceId: string) => ({ eventId, resourceId }))).onConflictDoNothing();
    }
    if (contactIds.length > 0) {
        await db.insert(eventContact).values(contactIds.map((contactId: string) => ({ eventId, contactId }))).onConflictDoNothing();
    }
}
