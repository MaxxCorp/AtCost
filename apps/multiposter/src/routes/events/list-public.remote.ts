import { query } from '$app/server';
import { db } from '$lib/server/db';
import { eq, and, or, gte, lte, desc, isNull, inArray, ilike } from 'drizzle-orm';
import { event, eventContact, contact, contactEmail, contactPhone, contactAddress, eventResource, resource, location, kiosk, kioskLocation, eventLocation, contactTag, tag, locationContact, eventTag } from '@ac/db';
import * as v from 'valibot';
import type { Event } from './list.remote';

export type PublicEvent = Omit<Event, 'resolvedContact'> & {
    resolvedContact: {
        name: string;
        company?: string | null;
        role?: string | null;
        department?: string | null;
        emails: { value: string; type: string | null; primary: boolean }[];
        phones: { value: string; type: string | null; primary: boolean }[];
        address: {
            street: string | null;
            houseNumber: string | null;
            zip: string | null;
            city: string | null;
            country: string | null;
        } | null;
        qrCodeDataUrl?: string;
    } | null;
    ticketPrice?: string | null;
    categoryBerlinDotDe?: string | null;
    qrCodeDataUrl?: string;
    confirmedParticipants?: number;
    maxOccupancy?: number | null;
    inclusivityInformation?: string[];
    roomTitle?: string | null;
    tags?: string[];
    locationIds?: string[];
    locations?: {
        id: string;
        name: string;
        street: string | null;
        houseNumber: string | null;
        zip: string | null;
        city: string | null;
        country: string | null;
        isPublic: boolean;
    }[];
};

export const listPublicEvents = query(async (): Promise<PublicEvent[]> => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const results = await db
        .select()
        .from(event)
        .where(
            and(
                eq(event.isPublic, true),
                gte(event.endDateTime, now)
            )
        )
        .orderBy(desc(event.startDateTime));

    if (results.length === 0) return [];

    // We can reuse the hydration logic function if I extract it, but I'll duplicate inline to keep it simple as before.
    return hydrateEvents(results);
});

export const listKioskEvents = query(v.string(), async (kioskId: string): Promise<PublicEvent[]> => {
    // 1. Fetch Kiosk and its Locations
    const kioskData = await db.query.kiosk.findFirst({
        where: eq(kiosk.id, kioskId),
    });

    if (!kioskData) return [];

    const kioskLocations = await db
        .select({ id: kioskLocation.locationId })
        .from(kioskLocation)
        .where(eq(kioskLocation.kioskId, kioskId));

    const kioskLocationIds = kioskLocations.map((l: any) => l.id);

    const now = new Date();

    // 2. Build Filter Criteria
    const conditions = [
        eq(event.isPublic, true),
    ];

    if (kioskData.rangeMode === 'fixed') {
        if (kioskData.startDate) {
            conditions.push(gte(event.endDateTime, kioskData.startDate));
        }
        if (kioskData.endDate) {
            conditions.push(lte(event.startDateTime, kioskData.endDate));
        }
    } else {
        const lookPastDate = new Date(now.getTime() - (kioskData.lookPast * 1000));
        const lookAheadDate = new Date(now.getTime() + (kioskData.lookAhead * 1000));

        conditions.push(gte(event.endDateTime, lookPastDate));
        conditions.push(lte(event.startDateTime, lookAheadDate));
    }

    // 3. Apply Location Filtering if Kiosk has locations
    if (kioskLocationIds.length > 0) {
        const locCondition = or(
            // Event matches one of the kiosk locations via join table
            inArray(
                event.id,
                db.select({ eventId: eventLocation.eventId })
                    .from(eventLocation)
                    .where(inArray(eventLocation.locationId, kioskLocationIds))
            ),
            // Resource matches one of the kiosk locations
            inArray(
                event.id,
                db.select({ eventId: eventResource.eventId })
                    .from(eventResource)
                    .innerJoin(resource, eq(eventResource.resourceId, resource.id))
                    .where(inArray(resource.locationId, kioskLocationIds))
            )
        );
        if (locCondition) {
            conditions.push(locCondition);
        }
    }

    const results = await db
        .selectDistinct({ id: event.id })
        .from(event)
        .where(and(...conditions));

    if (results.length === 0) return [];

    const eventIds = results.map((e: any) => e.id);
    const fullEvents = await db
        .select()
        .from(event)
        .where(inArray(event.id, eventIds))
        .orderBy(desc(event.startDateTime));

    return hydrateEvents(fullEvents);
});

// Helper for data hydration to stay DRY
async function hydrateEvents(events: any[]): Promise<PublicEvent[]> {
    const eventIds = events.map((e: any) => e.id);
    if (eventIds.length === 0) return [];

    const resourceData = await db
        .select({
            eventId: eventResource.eventId,
            maxOccupancy: resource.maxOccupancy,
            inclusivitySupport: location.inclusivitySupport,
            locationId: location.id,
            resourceName: resource.name,
            resourceType: resource.type
        })
        .from(eventResource)
        .innerJoin(resource, eq(eventResource.resourceId, resource.id))
        .leftJoin(location, eq(resource.locationId, location.id))
        .where(inArray(eventResource.eventId, eventIds));

    // Fetch direct locations (new multi-location support)
    const directLocationData = await db
        .select({
            eventId: eventLocation.eventId,
            locationId: eventLocation.locationId
        })
        .from(eventLocation)
        .where(inArray(eventLocation.eventId, eventIds));

    // Fetch event tags
    const eventTagsData = await db
        .select({
            eventId: eventTag.eventId,
            tagName: tag.name
        })
        .from(eventTag)
        .innerJoin(tag, eq(eventTag.tagId, tag.id))
        .where(inArray(eventTag.eventId, eventIds));

    const contactsData = await db
        .select({
            eventId: eventContact.eventId,
            contactId: eventContact.contactId,
            participationStatus: eventContact.participationStatus,
            displayName: contact.displayName,
            givenName: contact.givenName,
            familyName: contact.familyName,
            company: contact.company,
            role: contact.role,
            department: contact.department,
            qrCodePath: contact.qrCodePath,
        })
        .from(eventContact)
        .innerJoin(contact, eq(eventContact.contactId, contact.id))
        .where(inArray(eventContact.eventId, eventIds));

    const contactIds = contactsData.map((c: any) => c.contactId);

    // Fetch tags for event contacts to identify 'Employee'
    let contactEmployeeTags = new Set<string>();
    if (contactIds.length > 0) {
        const tags = await db.select({ contactId: contactTag.contactId })
            .from(contactTag)
            .innerJoin(tag, eq(contactTag.tagId, tag.id))
            .where(and(
                inArray(contactTag.contactId, contactIds),
                eq(tag.name, 'Employee')
            ));
        tags.forEach((t: any) => contactEmployeeTags.add(t.contactId));
    }

    // Collect all location IDs (from resources and direct assignment)
    const allLocationIds = new Set<string>();
    resourceData.forEach((r: any) => { if (r.locationId) allLocationIds.add(r.locationId); });
    directLocationData.forEach((l: any) => allLocationIds.add(l.locationId));

    // Fetch full location details
    let fullLocations: any[] = [];
    if (allLocationIds.size > 0) {
        fullLocations = await db
            .select()
            .from(location)
            .where(inArray(location.id, Array.from(allLocationIds)));
    }

    // Fetch 'Employee' contacts for these locations
    const locationEmployeeContacts: Record<string, string> = {}; // locationId -> contactId (first found)
    if (allLocationIds.size > 0) {
        const locIdsArr = Array.from(allLocationIds);
        const locContacts = await db
            .select({
                locationId: locationContact.locationId,
                contactId: locationContact.contactId
            })
            .from(locationContact)
            .innerJoin(contactTag, eq(locationContact.contactId, contactTag.contactId))
            .innerJoin(tag, eq(contactTag.tagId, tag.id))
            .where(and(
                inArray(locationContact.locationId, locIdsArr),
                eq(tag.name, 'Employee')
            ));

        // Map first employee contact per location
        for (const lc of locContacts) {
            if (!locationEmployeeContacts[lc.locationId]) {
                locationEmployeeContacts[lc.locationId] = lc.contactId;
            }
        }
    }

    // Capture IDs of location contacts to fetch their details if not already fetched
    const extraContactIds = Object.values(locationEmployeeContacts).filter(id => !contactIds.includes(id));
    const allContactIdsToFetch = [...contactIds, ...extraContactIds];

    let emails: any[] = [];
    let phones: any[] = [];
    let addresses: any[] = [];
    let extraContactDetails: any[] = [];

    if (allContactIdsToFetch.length > 0) {
        emails = await db.select({ contactId: contactEmail.contactId, value: contactEmail.value, type: contactEmail.type, primary: contactEmail.primary })
            .from(contactEmail).where(inArray(contactEmail.contactId, allContactIdsToFetch));
        phones = await db.select({ contactId: contactPhone.contactId, value: contactPhone.value, type: contactPhone.type, primary: contactPhone.primary })
            .from(contactPhone).where(inArray(contactPhone.contactId, allContactIdsToFetch));
        addresses = await db.select().from(contactAddress).where(inArray(contactAddress.contactId, allContactIdsToFetch));

        if (extraContactIds.length > 0) {
            extraContactDetails = await db.select({
                id: contact.id,
                displayName: contact.displayName,
                givenName: contact.givenName,
                familyName: contact.familyName,
                company: contact.company,
                role: contact.role,
                department: contact.department,
                qrCodePath: contact.qrCodePath,
            }).from(contact).where(inArray(contact.id, extraContactIds));
        }
    }

    return events.map((row: any) => {
        const transformedRow = {
            ...row,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
            startDateTime: row.startDateTime?.toISOString() ?? null,
            endDateTime: row.endDateTime?.toISOString() ?? null,
            resourceIds: [],
            contactIds: [],
            participationStatuses: {},
            resolvedContact: null,
            ticketPrice: row.ticketPrice ?? null,
            categoryBerlinDotDe: row.categoryBerlinDotDe ?? null,
            qrCodeDataUrl: undefined,
            confirmedParticipants: 0,
            maxOccupancy: null,
            inclusivityInformation: undefined
        };

        const evtContacts = contactsData.filter((c: any) => c.eventId === row.id);
        const acceptedCount = evtContacts.filter((c: any) => c.participationStatus === 'accepted').length;

        // Resolve Display Contact
        let chosenContactId: string | null = null;
        let chosenContactDetails: any = null;

        // 1. Event Contact with 'Employee' tag
        const employeeContact = evtContacts.find((c: any) => contactEmployeeTags.has(c.contactId));
        if (employeeContact) {
            chosenContactId = employeeContact.contactId;
            chosenContactDetails = employeeContact;
        }

        // 2. Location Contact with 'Employee' tag
        if (!chosenContactId) {
            // Get locations for this event
            const evtLocIds = [
                ...resourceData.filter((r: any) => r.eventId === row.id && r.locationId).map((r: any) => r.locationId!),
                ...directLocationData.filter((l: any) => l.eventId === row.id).map((l: any) => l.locationId)
            ];

            for (const locId of evtLocIds) {
                if (locationEmployeeContacts[locId]) {
                    chosenContactId = locationEmployeeContacts[locId];
                    // Find details
                    chosenContactDetails = evtContacts.find((c: any) => c.contactId === chosenContactId)
                        || extraContactDetails.find((c: any) => c.id === chosenContactId);
                    if (chosenContactDetails) break;
                }
            }
        }

        // 3. Fallback: First Event Contact
        if (!chosenContactId && evtContacts.length > 0) {
            chosenContactId = evtContacts[0].contactId;
            chosenContactDetails = evtContacts[0];
        }

        let resolvedContact = null;
        if (chosenContactId && chosenContactDetails) {
            const primaryAddress = addresses.filter(a => a.contactId === chosenContactId && a.type === 'work').find(a => a.primary) || addresses.filter(a => a.contactId === chosenContactId && a.type === 'work')[0];
            const workEmails = emails.filter(e => e.contactId === chosenContactId && e.type === 'work');
            const workPhones = phones.filter(p => p.contactId === chosenContactId && p.type === 'work');

            let publicQrCodePath = chosenContactDetails.qrCodePath || undefined;
            if (publicQrCodePath && !publicQrCodePath.includes('_public')) {
                publicQrCodePath = publicQrCodePath.replace('/qr.png', '/qr_public.png');
            }

            resolvedContact = {
                name: chosenContactDetails.displayName || `${chosenContactDetails.givenName || ''} ${chosenContactDetails.familyName || ''}`.trim(),
                company: chosenContactDetails.company,
                role: chosenContactDetails.role,
                department: chosenContactDetails.department,
                emails: workEmails.map(e => ({ value: e.value, type: e.type, primary: e.primary })),
                phones: workPhones.map(p => ({ value: p.value, type: p.type, primary: p.primary })),
                address: primaryAddress ? {
                    street: primaryAddress.street,
                    houseNumber: primaryAddress.houseNumber,
                    zip: primaryAddress.zip,
                    city: primaryAddress.city,
                    country: primaryAddress.country
                } : null,
                qrCodeDataUrl: publicQrCodePath
            };
        }

        const evtResources = resourceData.filter((r: any) => r.eventId === row.id);
        const totalCapacity = evtResources.reduce((sum: number, r: any) => sum + (r.maxOccupancy || 0), 0);
        const inclusivity = evtResources
            .map((r: any) => r.inclusivitySupport)
            .filter((i: any): i is string => !!i);

        return {
            ...transformedRow,
            resolvedContact,
            contactIds: evtContacts.map((c: any) => c.contactId),
            confirmedParticipants: acceptedCount,
            maxOccupancy: totalCapacity > 0 ? totalCapacity : null,
            inclusivityInformation: inclusivity.length > 0 ? [...new Set(inclusivity)] : undefined,
            roomTitle: evtResources.find((r: any) => r.resourceType === 'room')?.resourceName || evtResources[0]?.resourceName || null,
            tags: eventTagsData.filter((t: any) => t.eventId === row.id).map((t: any) => t.tagName).filter((t: any): t is string => !!t),
            locationIds: [
                ...new Set([
                    ...evtResources.filter((r: any) => r.locationId).map((r: any) => r.locationId!),
                    ...directLocationData.filter((l: any) => l.eventId === row.id).map((l: any) => l.locationId)
                ])
            ],
            locations: fullLocations.filter((l: any) =>
                (evtResources.some((er: any) => er.eventId === row.id && er.locationId === l.id) ||
                    directLocationData.some((dl: any) => dl.eventId === row.id && dl.locationId === l.id)) &&
                l.isPublic
            ).map((l: any) => ({
                id: l.id,
                name: l.name,
                street: l.street,
                houseNumber: l.houseNumber,
                zip: l.zip,
                city: l.city,
                country: l.country,
                isPublic: l.isPublic
            }))
        };
    });
}
