import { db, event, eventResource, eventContact, resource, account, eq, and, ne, inArray, lte, gte } from '@ac/db';
import { env } from '$env/dynamic/private';

export interface AvailabilityResult {
    available: boolean;
    reason?: string;
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

        const tenantId = env.MICROSOFT_TENANT_ID;
        const clientId = env.MICROSOFT_CLIENT_ID;
        const clientSecret = env.MICROSOFT_CLIENT_SECRET;

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

        if (!accessToken) return results;

        try {
            const endpoint = isUserToken
                ? 'https://graph.microsoft.com/v1.0/me/getSchedule'
                : 'https://graph.microsoft.com/v1.0/getSchedule';

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
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

            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data.value)) {
                    for (const item of data.value) {
                        const email = (item.scheduleId || '').toLowerCase();
                        const view = item.availabilityView || '';
                        // '0' = free, '1' = tentative, '2' = busy, '3' = out of office, '4' = working elsewhere
                        const isBusy = view.includes('1') || view.includes('2') || view.includes('3');
                        if (isBusy) {
                            results.set(email, {
                                available: false,
                                reason: 'Busy in Microsoft 365 Calendar'
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

        const resourceIds = params.resources.map(r => r.id);
        const contactIds = params.contacts.map(c => c.id);

        // 1. Local DB Collision Check for Resources
        if (resourceIds.length > 0) {
            const resourceCollisions = await db
                .select({
                    resourceId: eventResource.resourceId,
                    eventTitle: event.summary
                })
                .from(eventResource)
                .innerJoin(event, eq(eventResource.eventId, event.id))
                .where(and(
                    inArray(eventResource.resourceId, resourceIds),
                    ne(event.status, 'cancelled'),
                    params.currentEventId ? ne(event.id, params.currentEventId) : undefined,
                    lte(event.startDateTime, params.endDateTime),
                    gte(event.endDateTime, params.startDateTime)
                ));

            for (const c of resourceCollisions) {
                resourceAvailability[c.resourceId] = {
                    available: false,
                    reason: `Booked in "${c.eventTitle || 'another event'}"`
                };
            }
        }

        // 2. Local DB Collision Check for Contacts
        if (contactIds.length > 0) {
            const contactCollisions = await db
                .select({
                    contactId: eventContact.contactId,
                    eventTitle: event.summary
                })
                .from(eventContact)
                .innerJoin(event, eq(eventContact.eventId, event.id))
                .where(and(
                    inArray(eventContact.contactId, contactIds),
                    ne(event.status, 'cancelled'),
                    params.currentEventId ? ne(event.id, params.currentEventId) : undefined,
                    lte(event.startDateTime, params.endDateTime),
                    gte(event.endDateTime, params.startDateTime)
                ));

            for (const c of contactCollisions) {
                contactAvailability[c.contactId] = {
                    available: false,
                    reason: `Assigned to "${c.eventTitle || 'another event'}"`
                };
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
                        if (target && !res.available) {
                            if (target.type === 'resource') {
                                resourceAvailability[target.id] = res;
                            } else {
                                contactAvailability[target.id] = res;
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
