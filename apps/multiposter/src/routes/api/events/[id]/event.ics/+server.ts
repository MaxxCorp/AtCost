import { db, sql } from '@ac/db';
import ICAL from 'ical.js';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cached, cacheKeys } from '#lib/server/cache/index.js';
import { getOptionalUser, hasAccess } from '#lib/server/authorization.js';
import { isPublicLocation, isPublicContact } from '#lib/server/public-sanitization.js';

export const GET: RequestHandler = async ({ params }) => {
    const eventId = params.id;
    const user = getOptionalUser();
    const isAuthorized = Boolean(user && hasAccess(user, 'events'));

    const buildIcs = async (publicOnly: boolean) => {
        let data: any = null;
        const isVirtual = eventId.includes('_inst_');

        if (isVirtual) {
            const [masterId, instIso] = eventId.split('_inst_');
            const decodedIso = decodeURIComponent(instIso);
            data = await db.query.event.findFirst({
                where: (table, { and, eq, or }) => and(
                    eq(table.recurringEventId, masterId),
                    or(
                        sql`${table.originalStartTime}->>'dateTime' = ${instIso}`,
                        sql`${table.originalStartTime}->>'dateTime' = ${decodedIso}`
                    )
                ),
                with: {
                    locations: { with: { location: true } },
                    contacts: { with: { contact: true } }
                }
            });

            if (!data) {
                const master = await db.query.event.findFirst({
                    where: (table, { eq }) => eq(table.id, masterId),
                    with: {
                        locations: { with: { location: true } },
                        contacts: { with: { contact: true } }
                    }
                });
                if (master && instIso) {
                    const masterExdates = Array.isArray(master.exdates) ? (master.exdates as string[]) : [];
                    const targetDate = new Date(decodedIso);
                    if (!isNaN(targetDate.getTime())) {
                        const isExcluded = masterExdates.some(ex => {
                            const exTime = new Date(ex).getTime();
                            return !isNaN(exTime) && Math.abs(exTime - targetDate.getTime()) < 60000;
                        });
                        if (!isExcluded) {
                            const duration = (master.startDateTime && master.endDateTime)
                                ? (new Date(master.endDateTime).getTime() - new Date(master.startDateTime).getTime())
                                : 3600000;
                            data = {
                                ...master,
                                id: eventId,
                                startDateTime: targetDate,
                                endDateTime: new Date(targetDate.getTime() + duration),
                                recurrence: null
                            };
                        }
                    }
                }
            }
        } else {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId);
            if (isUuid) {
                data = await db.query.event.findFirst({
                    where: (table, { eq }) => eq(table.id, eventId),
                    with: {
                        locations: { with: { location: true } },
                        contacts: { with: { contact: true } }
                    }
                });
            }
        }

        if (!data) {
            error(404, 'Event not found');
        }

        if (publicOnly && !data.isPublic) {
            error(403, 'Forbidden');
        }

        const vcalendar = new ICAL.Component(['vcalendar', [], []]);
        vcalendar.addPropertyWithValue('prodid', '-//MaxxCorp//ac-multiposter//EN');
        vcalendar.addPropertyWithValue('version', '2.0');

        const vevent = new ICAL.Component('vevent');
        vevent.addPropertyWithValue('uid', data.iCalUID || eventId);
        vevent.addPropertyWithValue('summary', data.summary);
        if (data.description) vevent.addPropertyWithValue('description', data.description);
        
        const locationParts: string[] = [];
        data.locations?.forEach((el: any) => {
            const l = el.location;
            if (l && (!publicOnly || isPublicLocation(l))) {
                let locStr = l.name;
                if (l.roomId) locStr += ` (${l.roomId})`;
                if (!locationParts.includes(locStr)) locationParts.push(locStr);
            }
        });
        if (locationParts.length > 0) {
            vevent.addPropertyWithValue('location', locationParts.join(', '));
        }

        data.contacts?.forEach((ec: any) => {
            const c = ec.contact;
            if (c && (!publicOnly || isPublicContact(c))) {
                const name = c.displayName || `${c.givenName || ''} ${c.familyName || ''}`.trim();
                if (name) {
                    const attendee = vevent.addPropertyWithValue('attendee', 'MAILTO:no-reply@example.com');
                    attendee.setParameter('cn', name);
                    if (ec.participationStatus) {
                        const statusMap: Record<string, string> = {
                            'accepted': 'ACCEPTED',
                            'declined': 'DECLINED',
                            'tentative': 'TENTATIVE',
                            'needsAction': 'NEEDS-ACTION'
                        };
                        attendee.setParameter('partstat', statusMap[ec.participationStatus] || 'NEEDS-ACTION');
                    }
                }
            }
        });

        if (data.startDateTime) vevent.addPropertyWithValue('dtstart', ICAL.Time.fromJSDate(data.startDateTime, true));
        if (data.endDateTime) vevent.addPropertyWithValue('dtend', ICAL.Time.fromJSDate(data.endDateTime, true));
        vevent.addPropertyWithValue('dtstamp', ICAL.Time.fromJSDate(data.updatedAt, true));

        if (data.recurrence && Array.isArray(data.recurrence) && data.recurrence[0]) {
            try {
                const cleanRule = data.recurrence[0].replace(/^RRULE:/i, '');
                vevent.addPropertyWithValue('rrule', ICAL.Recur.fromString(cleanRule));
            } catch (e) {
                console.warn('Failed to parse RRULE for ICS:', e);
            }
        }

        if (data.exdates && Array.isArray(data.exdates) && data.exdates.length > 0) {
            for (const ex of data.exdates) {
                const exD = new Date(ex);
                if (!isNaN(exD.getTime())) {
                    vevent.addPropertyWithValue('exdate', ICAL.Time.fromJSDate(exD, true));
                }
            }
        }

        vcalendar.addSubcomponent(vevent);

        const icsContent = vcalendar.toString();
        return {
            summary: data.summary,
            icsContent
        };
    };

    const result = isAuthorized
        ? await buildIcs(false)
        : await cached(cacheKeys.eventIcs(eventId), 3600, () => buildIcs(true));

    return new Response(new Uint8Array(Buffer.from(result.icsContent)), {
        headers: {
            'Content-Type': 'text/calendar',
            'Content-Disposition': `attachment; filename="${result.summary.replace(/\s+/g, '_')}.ics"`,
            'Cache-Control': isAuthorized ? 'private, max-age=60' : 'public, max-age=60'
        }
    });
};
