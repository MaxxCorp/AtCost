import {
    db,
    event,
    eventResource,
    eventContact,
    resource,
    account,
    recurringSeries,
    eq,
    and,
    ne,
    or,
    inArray,
    lt,
    gt,
    isNotNull
} from '@ac/db';
import { expandRecurrenceRange } from '#lib/server/events/recurrence.js';

import {
    MICROSOFT_TENANT_ID,
    MICROSOFT_CLIENT_ID,
    MICROSOFT_CLIENT_SECRET
} from '$app/env/private';

export interface AvailabilityResult {
    available: boolean;
    reason?: string;
    eventId?: string;
    eventTitle?: string;
    scheduleItems?: Array<{
        status: string;
        subject?: string;
        start?: Date;
        end?: Date;
    }>;
}

export interface AvailabilityProvider {
    readonly name: string;
    checkSchedule(
        emails: string[],
        startDateTime: Date,
        endDateTime: Date,
        userId?: string
    ): Promise<Map<string, AvailabilityResult>>;
}

export class MicrosoftAvailabilityProvider implements AvailabilityProvider {
    readonly name = 'microsoft';

    async checkSchedule(
        emails: string[],
        startDateTime: Date,
        endDateTime: Date,
        userId?: string
    ): Promise<Map<string, AvailabilityResult>> {
        const results = new Map<string, AvailabilityResult>();
        if (emails.length === 0) return results;

        const tenantId = MICROSOFT_TENANT_ID;
        const clientId = MICROSOFT_CLIENT_ID;
        const clientSecret = MICROSOFT_CLIENT_SECRET;

        let accessToken: string | null = null;
        let isUserToken = false;

        if (tenantId && clientId && clientSecret) {
            try {
                const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        client_id: clientId,
                        client_secret: clientSecret,
                        grant_type: 'client_credentials',
                        scope: 'https://graph.microsoft.com/.default'
                    })
                });
                if (tokenRes.ok) {
                    const tokenData = await tokenRes.json();
                    accessToken = tokenData.access_token;
                }
            } catch (e) {
                console.warn('[MicrosoftAvailabilityProvider] Failed app credentials token fetch:', e);
            }
        }

        if (!accessToken && userId) {
            const [userAccount] = await db
                .select()
                .from(account)
                .where(and(eq(account.userId, userId), eq(account.providerId, 'microsoft')))
                .limit(1);

            if (userAccount?.accessToken) {
                accessToken = userAccount.accessToken;
                isUserToken = true;
            }
        }

        const makeScheduleCall = async (token: string, asUser: boolean) => {
            const endpoint = asUser
                ? 'https://graph.microsoft.com/v1.0/me/calendar/getSchedule'
                : emails.length > 0
                    ? `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(emails[0])}/calendar/getSchedule`
                    : null;

            if (!endpoint) return null;

            return await fetch(endpoint, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    schedules: emails,
                    startTime: {
                        dateTime: startDateTime.toISOString(),
                        timeZone: 'UTC'
                    },
                    endTime: {
                        dateTime: endDateTime.toISOString(),
                        timeZone: 'UTC'
                    },
                    availabilityViewInterval: 60
                })
            });
        };

        const getUserToken = async (): Promise<string | null> => {
            if (!userId) return null;
            const [userAccount] = await db
                .select()
                .from(account)
                .where(and(eq(account.userId, userId), eq(account.providerId, 'microsoft')))
                .limit(1);
            return userAccount?.accessToken || null;
        };

        try {
            let response: Response | null = null;
            if (accessToken) {
                response = await makeScheduleCall(accessToken, isUserToken);
                // If app token was rejected with 403 or 401 and we have a userId, fallback to user delegated token
                if (response && (response.status === 403 || response.status === 401) && !isUserToken && userId) {
                    console.log(`[MicrosoftAvailabilityProvider] App token returned ${response.status}. Falling back to user delegated token for user ${userId}...`);
                    const userToken = await getUserToken();
                    if (userToken) {
                        accessToken = userToken;
                        isUserToken = true;
                        response = await makeScheduleCall(userToken, true);
                    }
                }
            } else if (userId) {
                const userToken = await getUserToken();
                if (userToken) {
                    accessToken = userToken;
                    isUserToken = true;
                    response = await makeScheduleCall(userToken, true);
                }
            }

            if (!response) return results;

            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data.value)) {
                    for (const item of data.value) {
                        const email = (item.scheduleId || '').toLowerCase();
                        const busyItems: Array<{ status: string; subject?: string; start?: Date; end?: Date }> = [];
                        if (Array.isArray(item.scheduleItems)) {
                            for (const s of item.scheduleItems) {
                                if (['busy', 'tentative', 'oof'].includes((s.status || '').toLowerCase())) {
                                    const sStart = s.start?.dateTime ? new Date(s.start.dateTime + (s.start.timeZone === 'UTC' ? 'Z' : '')) : undefined;
                                    const sEnd = s.end?.dateTime ? new Date(s.end.dateTime + (s.end.timeZone === 'UTC' ? 'Z' : '')) : undefined;
                                    // Verify strict half-open interval overlap with requested interval:
                                    // [sStart, sEnd) overlaps [startDateTime, endDateTime) iff sStart < endDateTime && sEnd > startDateTime
                                    if (sStart && sEnd && !isNaN(sStart.getTime()) && !isNaN(sEnd.getTime())) {
                                        if (sStart >= endDateTime || sEnd <= startDateTime) {
                                            continue; // Touching at boundary or outside interval
                                        }
                                    }
                                    busyItems.push({
                                        status: s.status,
                                        subject: s.subject || undefined,
                                        start: sStart,
                                        end: sEnd
                                    });
                                }
                            }
                        }

                        const view = item.availabilityView || '';
                        const viewHasBusy = view.includes('1') || view.includes('2') || view.includes('3');
                        // Busy if there are strictly overlapping busy scheduleItems, or if scheduleItems was empty but view flagged busy
                        const isBusy = busyItems.length > 0 || (Array.isArray(item.scheduleItems) && item.scheduleItems.length === 0 && viewHasBusy);

                        if (isBusy) {
                            const eventTitle = busyItems[0]?.subject;
                            results.set(email, {
                                available: false,
                                reason: eventTitle ? `Busy in Microsoft 365: "${eventTitle}"` : 'Busy in Microsoft 365 Calendar',
                                eventTitle,
                                scheduleItems: busyItems
                            });
                        } else {
                            results.set(email, { available: true });
                        }
                    }
                }
            } else {
                console.warn(`[MicrosoftAvailabilityProvider] getSchedule returned ${response.status}: ${await response.text()}`);
            }
        } catch (e) {
            console.error('[MicrosoftAvailabilityProvider] Exception during checkSchedule:', e);
        }

        return results;
    }
}

export class AvailabilityService {
    private providers: AvailabilityProvider[] = [
        new MicrosoftAvailabilityProvider()
    ];

    async checkAvailability(params: {
        startDateTime: Date;
        endDateTime: Date;
        currentEventId?: string;
        resources: Array<{ id: string; allocationCalendars?: any }>;
        contacts: Array<{ id: string; email?: string }>;
        userId?: string;
    }): Promise<{
        resourceAvailability: Record<string, AvailabilityResult>;
        contactAvailability: Record<string, AvailabilityResult>;
    }> {
        const resourceAvailability: Record<string, AvailabilityResult> = {};
        const contactAvailability: Record<string, AvailabilityResult> = {};

        const isVirtual = Boolean(params.currentEventId && params.currentEventId.includes('_inst_'));
        const currentMasterId = isVirtual ? (params.currentEventId!).split('_inst_')[0] : null;

        const currentInstIso = isVirtual
            ? decodeURIComponent((params.currentEventId!).split('_inst_')[1])
            : null;

        const isUuid = Boolean(params.currentEventId && (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).test(params.currentEventId));
        const dbCurrentEventId = isUuid ? params.currentEventId : null;
        const targetMasterId = currentMasterId || dbCurrentEventId;

        const resourceIds = params.resources.map((r) => r.id);
        const contactIds = params.contacts.map((c) => c.id);

        const seriesMap = new Map<string, string>();
        const loadSeriesRrules = async (seriesIds: string[]) => {
            const missing = seriesIds.filter((id) => !seriesMap.has(id));
            if (missing.length === 0) return;
            const seriesRows = await db
                .select({ id: recurringSeries.id, rrule: recurringSeries.rrule })
                .from(recurringSeries)
                .where(inArray(recurringSeries.id, missing));
            for (const s of seriesRows) {
                if (s.rrule) seriesMap.set(s.id, s.rrule);
            }
        };

        // Helper to check if a booking matches the requested time window
        const isBookingActiveAtTime = (booking: {
            startDateTime: Date | null;
            endDateTime: Date | null;
            recurrence: any;
            seriesId: string | null;
            exdates: any;
            startTimeZone: string | null;
        }): boolean => {
            let rrule: string | null = null;
            if (Array.isArray(booking.recurrence) && booking.recurrence[0]) {
                rrule = booking.recurrence[0];
            } else if (booking.seriesId) {
                rrule = seriesMap.get(booking.seriesId) || null;
            }

            if (rrule && booking.startDateTime) {
                const exdates = Array.isArray(booking.exdates) ? (booking.exdates as string[]) : [];
                const durationMs = booking.endDateTime
                    ? new Date(booking.endDateTime).getTime() - new Date(booking.startDateTime).getTime()
                    : 0;
                const rangeSearchStart = new Date(params.startDateTime.getTime() - durationMs);
                const occurrences = expandRecurrenceRange(
                    rrule,
                    new Date(booking.startDateTime),
                    booking.endDateTime ? new Date(booking.endDateTime) : null,
                    rangeSearchStart,
                    params.endDateTime,
                    booking.startTimeZone,
                    exdates
                );
                return occurrences.some((occ) => {
                    const occStart = (occ.date || (occ as any).start).getTime();
                    const occEnd = occ.end ? occ.end.getTime() : occStart + durationMs;
                    return occStart < params.endDateTime.getTime() && occEnd > params.startDateTime.getTime();
                });
            } else if (booking.startDateTime && booking.endDateTime) {
                const bStart = new Date(booking.startDateTime).getTime();
                const bEnd = new Date(booking.endDateTime).getTime();
                return bStart < params.endDateTime.getTime() && bEnd > params.startDateTime.getTime();
            }

            return false;
        };

        // Preload any bookings belonging to the current event (to avoid self-collision with external synced calendars)
        let currentEventResourceBookings: Array<{
            eventId: string;
            resourceId: string;
            summary: string | null;
            startDateTime: Date | null;
            endDateTime: Date | null;
            recurrence: any;
            seriesId: string | null;
            exdates: any;
            startTimeZone: string | null;
        }> = [];

        let currentEventContactBookings: Array<{
            eventId: string;
            contactId: string;
            summary: string | null;
            startDateTime: Date | null;
            endDateTime: Date | null;
            recurrence: any;
            seriesId: string | null;
            exdates: any;
            startTimeZone: string | null;
        }> = [];

        if (targetMasterId) {
            try {
                currentEventResourceBookings = await db
                    .select({
                        eventId: eventResource.eventId,
                        resourceId: eventResource.resourceId,
                        summary: event.summary,
                        startDateTime: event.startDateTime,
                        endDateTime: event.endDateTime,
                        recurrence: event.recurrence,
                        seriesId: event.seriesId,
                        exdates: event.exdates,
                        startTimeZone: event.startTimeZone
                    })
                    .from(eventResource)
                    .innerJoin(event, eq(eventResource.eventId, event.id))
                    .where(and(
                        eq(event.id, targetMasterId),
                        ne(event.status, 'cancelled')
                    ));

                currentEventContactBookings = await db
                    .select({
                        eventId: eventContact.eventId,
                        contactId: eventContact.contactId,
                        summary: event.summary,
                        startDateTime: event.startDateTime,
                        endDateTime: event.endDateTime,
                        recurrence: event.recurrence,
                        seriesId: event.seriesId,
                        exdates: event.exdates,
                        startTimeZone: event.startTimeZone
                    })
                    .from(eventContact)
                    .innerJoin(event, eq(eventContact.eventId, event.id))
                    .where(and(
                        eq(event.id, targetMasterId),
                        ne(event.status, 'cancelled')
                    ));

                const currentSeriesIds = [
                    ...currentEventResourceBookings.map((b) => b.seriesId),
                    ...currentEventContactBookings.map((b) => b.seriesId)
                ].filter((id): id is string => Boolean(id));
                if (currentSeriesIds.length > 0) {
                    await loadSeriesRrules(currentSeriesIds);
                }
            } catch {
                // If tables aren't available or mock DB in unit tests without this mock, ignore gracefully
            }
        }

        // 1. Local DB Collision Check for Resources
        if (resourceIds.length > 0) {
            const resourceCollisions = await db
                .select({
                    resourceId: eventResource.resourceId,
                    eventId: event.id,
                    eventTitle: event.summary
                })
                .from(eventResource)
                .innerJoin(event, eq(eventResource.eventId, event.id))
                .where(and(
                    inArray(eventResource.resourceId, resourceIds),
                    ne(event.status, 'cancelled'),
                    dbCurrentEventId ? ne(event.id, dbCurrentEventId) : undefined,
                    lt(event.startDateTime, params.endDateTime),
                    gt(event.endDateTime, params.startDateTime)
                ));

            for (const c of resourceCollisions) {
                resourceAvailability[c.resourceId] = {
                    available: false,
                    reason: `Booked in "${c.eventTitle || 'another event'}"`,
                    eventId: c.eventId,
                    eventTitle: c.eventTitle || undefined
                };
            }

            // Check recurring events linked to resources for occurrence collisions within the requested range
            const unflaggedResourceIds = resourceIds.filter((id) => !resourceAvailability[id] || resourceAvailability[id].available !== false);
            if (unflaggedResourceIds.length > 0) {
                const recurringEvents = await db
                    .select({
                        resourceId: eventResource.resourceId,
                        eventId: event.id,
                        eventTitle: event.summary,
                        startDateTime: event.startDateTime,
                        endDateTime: event.endDateTime,
                        recurrence: event.recurrence,
                        seriesId: event.seriesId,
                        exdates: event.exdates,
                        startTimeZone: event.startTimeZone
                    })
                    .from(eventResource)
                    .innerJoin(event, eq(eventResource.eventId, event.id))
                    .where(and(
                        inArray(eventResource.resourceId, unflaggedResourceIds),
                        ne(event.status, 'cancelled'),
                        dbCurrentEventId ? ne(event.id, dbCurrentEventId) : undefined,
                        or(isNotNull(event.recurrence), isNotNull(event.seriesId))
                    ));

                const resourceSeriesIds = Array.from(new Set((recurringEvents || []).map((r) => r.seriesId).filter((id): id is string => Boolean(id))));
                if (resourceSeriesIds.length > 0) {
                    await loadSeriesRrules(resourceSeriesIds);
                }

                for (const r of (recurringEvents || [])) {
                    if (resourceAvailability[r.resourceId] && !resourceAvailability[r.resourceId].available) continue;
                    if (!r.startDateTime) continue;

                    let rrule: string | null = null;
                    if (Array.isArray(r.recurrence) && r.recurrence[0]) {
                        rrule = r.recurrence[0];
                    } else if (r.seriesId) {
                        rrule = seriesMap.get(r.seriesId) || null;
                    }

                    if (rrule) {
                        const exdates = Array.isArray(r.exdates) ? (r.exdates as string[]) : [];
                        const durationMs = r.endDateTime
                            ? new Date(r.endDateTime).getTime() - new Date(r.startDateTime).getTime()
                            : 0;
                        const rangeSearchStart = new Date(params.startDateTime.getTime() - durationMs);
                        const occurrences = expandRecurrenceRange(
                            rrule,
                            new Date(r.startDateTime),
                            r.endDateTime ? new Date(r.endDateTime) : null,
                            rangeSearchStart,
                            params.endDateTime,
                            r.startTimeZone,
                            exdates
                        );

                        // If checking an instance belonging to this master event, exclude the instance itself
                        const conflictingOccurrences = occurrences.filter((occ) => {
                            if (r.eventId === currentMasterId && currentInstIso) {
                                const occTime = (occ.date || (occ as any).start).getTime();
                                const targetTime = new Date(currentInstIso).getTime();
                                if (Math.abs(occTime - targetTime) < 60000) return false;
                            }
                            const occStart = (occ.date || (occ as any).start).getTime();
                            const occEnd = occ.end ? occ.end.getTime() : occStart + durationMs;
                            return occStart < params.endDateTime.getTime() && occEnd > params.startDateTime.getTime();
                        });

                        if (conflictingOccurrences.length > 0) {
                            resourceAvailability[r.resourceId] = {
                                available: false,
                                reason: `Booked in "${r.eventTitle || 'another event'}"`,
                                eventId: r.eventId,
                                eventTitle: r.eventTitle || undefined
                            };
                        }
                    }
                }
            }
        }

        // 2. Local DB Collision Check for Contacts
        if (contactIds.length > 0) {
            const contactCollisions = await db
                .select({
                    contactId: eventContact.contactId,
                    eventId: event.id,
                    eventTitle: event.summary
                })
                .from(eventContact)
                .innerJoin(event, eq(eventContact.eventId, event.id))
                .where(and(
                    inArray(eventContact.contactId, contactIds),
                    ne(event.status, 'cancelled'),
                    dbCurrentEventId ? ne(event.id, dbCurrentEventId) : undefined,
                    lt(event.startDateTime, params.endDateTime),
                    gt(event.endDateTime, params.startDateTime)
                ));

            for (const c of contactCollisions) {
                contactAvailability[c.contactId] = {
                    available: false,
                    reason: `Assigned to "${c.eventTitle || 'another event'}"`,
                    eventId: c.eventId,
                    eventTitle: c.eventTitle || undefined
                };
            }

            // Check recurring events for contacts
            const unflaggedContactIds = contactIds.filter((id) => !contactAvailability[id] || contactAvailability[id].available !== false);
            if (unflaggedContactIds.length > 0) {
                const recurringContactEvents = await db
                    .select({
                        contactId: eventContact.contactId,
                        eventId: event.id,
                        eventTitle: event.summary,
                        startDateTime: event.startDateTime,
                        endDateTime: event.endDateTime,
                        recurrence: event.recurrence,
                        seriesId: event.seriesId,
                        exdates: event.exdates,
                        startTimeZone: event.startTimeZone
                    })
                    .from(eventContact)
                    .innerJoin(event, eq(eventContact.eventId, event.id))
                    .where(and(
                        inArray(eventContact.contactId, unflaggedContactIds),
                        ne(event.status, 'cancelled'),
                        dbCurrentEventId ? ne(event.id, dbCurrentEventId) : undefined,
                        or(isNotNull(event.recurrence), isNotNull(event.seriesId))
                    ));

                const contactSeriesIds = Array.from(new Set((recurringContactEvents || []).map((r) => r.seriesId).filter((id): id is string => Boolean(id))));
                if (contactSeriesIds.length > 0) {
                    await loadSeriesRrules(contactSeriesIds);
                }

                for (const r of (recurringContactEvents || [])) {
                    if (contactAvailability[r.contactId] && !contactAvailability[r.contactId].available) continue;
                    if (!r.startDateTime) continue;

                    let rrule: string | null = null;
                    if (Array.isArray(r.recurrence) && r.recurrence[0]) {
                        rrule = r.recurrence[0];
                    } else if (r.seriesId) {
                        rrule = seriesMap.get(r.seriesId) || null;
                    }

                    if (rrule) {
                        const exdates = Array.isArray(r.exdates) ? (r.exdates as string[]) : [];
                        const durationMs = r.endDateTime
                            ? new Date(r.endDateTime).getTime() - new Date(r.startDateTime).getTime()
                            : 0;
                        const rangeSearchStart = new Date(params.startDateTime.getTime() - durationMs);
                        const occurrences = expandRecurrenceRange(
                            rrule,
                            new Date(r.startDateTime),
                            r.endDateTime ? new Date(r.endDateTime) : null,
                            rangeSearchStart,
                            params.endDateTime,
                            r.startTimeZone,
                            exdates
                        );

                        // If checking an instance belonging to this master event, exclude the instance itself
                        const conflictingOccurrences = occurrences.filter((occ) => {
                            if (r.eventId === currentMasterId && currentInstIso) {
                                const occTime = (occ.date || (occ as any).start).getTime();
                                const targetTime = new Date(currentInstIso).getTime();
                                if (Math.abs(occTime - targetTime) < 60000) return false;
                            }
                            const occStart = (occ.date || (occ as any).start).getTime();
                            const occEnd = occ.end ? occ.end.getTime() : occStart + durationMs;
                            return occStart < params.endDateTime.getTime() && occEnd > params.startDateTime.getTime();
                        });

                        if (conflictingOccurrences.length > 0) {
                            contactAvailability[r.contactId] = {
                                available: false,
                                reason: `Assigned to "${r.eventTitle || 'another event'}"`,
                                eventId: r.eventId,
                                eventTitle: r.eventTitle || undefined
                            };
                        }
                    }
                }
            }
        }

        // Collect external calendar emails for remaining resources & contacts
        const emailsToCheck: string[] = [];
        const emailToTarget: Map<string, { type: 'resource' | 'contact'; id: string }> = new Map();

        for (const res of params.resources) {
            if (resourceAvailability[res.id] && !resourceAvailability[res.id].available) continue;

            let calendars: any[] = [];
            if (typeof res.allocationCalendars === 'string') {
                try { calendars = JSON.parse(res.allocationCalendars); } catch { calendars = []; }
            } else if (Array.isArray(res.allocationCalendars)) {
                calendars = res.allocationCalendars;
            }

            for (const cal of calendars) {
                const email = cal.calendarId || cal.email;
                if (email && typeof email === 'string' && email.includes('@')) {
                    const lower = email.toLowerCase();
                    emailsToCheck.push(lower);
                    emailToTarget.set(lower, { type: 'resource', id: res.id });
                }
            }
        }

        for (const c of params.contacts) {
            if (contactAvailability[c.id] && !contactAvailability[c.id].available) continue;
            if (c.email && typeof c.email === 'string' && c.email.includes('@')) {
                const lower = c.email.toLowerCase();
                emailsToCheck.push(lower);
                emailToTarget.set(lower, { type: 'contact', id: c.id });
            }
        }

        // 3. Query External Providers
        if (emailsToCheck.length > 0) {
            for (const provider of this.providers) {
                try {
                    const scheduleResults = await provider.checkSchedule(
                        emailsToCheck,
                        params.startDateTime,
                        params.endDateTime,
                        params.userId
                    );

                    for (const [email, res] of scheduleResults) {
                        const target = emailToTarget.get(email);
                        if (!target || res.available) continue;

                        if (target.type === 'resource') {
                            // Check if this external busy slot is the booking of the current event itself
                            const booking = currentEventResourceBookings.find((b) => b.resourceId === target.id);
                            if (booking && isBookingActiveAtTime(booking)) {
                                const busyItems = res.scheduleItems || [];
                                // If at most 1 busy item, it is this event's own entry in Microsoft 365
                                if (busyItems.length <= 1) {
                                    resourceAvailability[target.id] = { available: true };
                                    continue;
                                }
                            }
                            resourceAvailability[target.id] = res;
                        } else {
                            const booking = currentEventContactBookings.find((b) => b.contactId === target.id);
                            if (booking && isBookingActiveAtTime(booking)) {
                                const busyItems = res.scheduleItems || [];
                                if (busyItems.length <= 1) {
                                    contactAvailability[target.id] = { available: true };
                                    continue;
                                }
                            }
                            contactAvailability[target.id] = res;
                        }
                    }

                    // For any newly flagged busy resources from external provider without eventId,
                    // correlate with local events that booked this resource
                    const externalBusyResourceIds = Object.entries(resourceAvailability)
                        .filter(([_, r]) => !r.available && !r.eventId)
                        .map(([id]) => id);

                    if (externalBusyResourceIds.length > 0) {
                        for (const resId of externalBusyResourceIds) {
                            const r = resourceAvailability[resId];
                            if (!r || r.eventId) continue;

                            // 1. Check non-recurring local events booked in this resource
                            const localBookings = await db
                                .select({
                                    eventId: event.id,
                                    eventTitle: event.summary
                                })
                                .from(eventResource)
                                .innerJoin(event, eq(eventResource.eventId, event.id))
                                .where(and(
                                    eq(eventResource.resourceId, resId),
                                    ne(event.status, 'cancelled'),
                                    targetMasterId ? ne(event.id, targetMasterId) : undefined,
                                    lt(event.startDateTime, params.endDateTime),
                                    gt(event.endDateTime, params.startDateTime)
                                ));

                            const localBooking = localBookings?.[0];
                            if (localBooking) {
                                r.eventId = localBooking.eventId;
                                r.eventTitle = localBooking.eventTitle || undefined;
                                r.reason = `Booked in "${localBooking.eventTitle || 'another event'}"`;
                                continue;
                            }

                            // 2. Check recurring local events booked in this resource
                            const recurringResourceBookings = await db
                                .select({
                                    eventId: event.id,
                                    eventTitle: event.summary,
                                    startDateTime: event.startDateTime,
                                    endDateTime: event.endDateTime,
                                    recurrence: event.recurrence,
                                    seriesId: event.seriesId,
                                    exdates: event.exdates,
                                    startTimeZone: event.startTimeZone
                                })
                                .from(eventResource)
                                .innerJoin(event, eq(eventResource.eventId, event.id))
                                .where(and(
                                    eq(eventResource.resourceId, resId),
                                    ne(event.status, 'cancelled'),
                                    targetMasterId ? ne(event.id, targetMasterId) : undefined,
                                    or(isNotNull(event.recurrence), isNotNull(event.seriesId))
                                ));

                            const recSeriesIds = Array.from(new Set((recurringResourceBookings || []).map((rb) => rb.seriesId).filter((id): id is string => Boolean(id))));
                            if (recSeriesIds.length > 0) {
                                await loadSeriesRrules(recSeriesIds);
                            }

                            for (const rec of (recurringResourceBookings || [])) {
                                if (!rec.startDateTime) continue;
                                let rrule: string | null = null;
                                if (Array.isArray(rec.recurrence) && rec.recurrence[0]) {
                                    rrule = rec.recurrence[0];
                                } else if (rec.seriesId) {
                                    rrule = seriesMap.get(rec.seriesId) || null;
                                }

                                if (rrule) {
                                    const exdates = Array.isArray(rec.exdates) ? (rec.exdates as string[]) : [];
                                    const durationMs = rec.endDateTime
                                        ? new Date(rec.endDateTime).getTime() - new Date(rec.startDateTime).getTime()
                                        : 0;
                                    const rangeSearchStart = new Date(params.startDateTime.getTime() - durationMs);
                                    const occurrences = expandRecurrenceRange(
                                        rrule,
                                        new Date(rec.startDateTime),
                                        rec.endDateTime ? new Date(rec.endDateTime) : null,
                                        rangeSearchStart,
                                        params.endDateTime,
                                        rec.startTimeZone,
                                        exdates
                                    );
                                    const hasConflict = occurrences.some((occ) => {
                                        const occStart = (occ.date || (occ as any).start).getTime();
                                        const occEnd = occ.end ? occ.end.getTime() : occStart + durationMs;
                                        return occStart < params.endDateTime.getTime() && occEnd > params.startDateTime.getTime();
                                    });

                                    if (hasConflict) {
                                        r.eventId = rec.eventId;
                                        r.eventTitle = rec.eventTitle || undefined;
                                        r.reason = `Booked in "${rec.eventTitle || 'another event'}"`;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error(`[AvailabilityService] Error running provider ${provider.name}:`, e);
                }
            }
        }

        // Default any unflagged targets to available: true
        for (const r of params.resources) {
            if (!resourceAvailability[r.id]) {
                resourceAvailability[r.id] = { available: true };
            }
        }
        for (const c of params.contacts) {
            if (!contactAvailability[c.id]) {
                contactAvailability[c.id] = { available: true };
            }
        }

        return { resourceAvailability, contactAvailability };
    }
}

export const availabilityService = new AvailabilityService();
