import { db } from '@ac/db';
import ICAL from 'ical.js';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
    const eventId = params.id;
    const data = await db.query.event.findFirst({
        where: (table, { eq }) => eq(table.id, eventId),
        with: {
            locations: { with: { location: true } },
            contacts: { with: { contact: true } }
        }
    });

    if (!data) {
        error(404, 'Event not found');
    }

    const vcalendar = new ICAL.Component(['vcalendar', [], []]);
    vcalendar.addPropertyWithValue('prodid', '-//MaxxCorp//ac-multiposter//EN');
    vcalendar.addPropertyWithValue('version', '2.0');

    const vevent = new ICAL.Component('vevent');
    vevent.addPropertyWithValue('uid', data.iCalUID || eventId);
    vevent.addPropertyWithValue('summary', data.summary);
    if (data.description) vevent.addPropertyWithValue('description', data.description);
    
    const locationParts: string[] = [];
    if (data.location) locationParts.push(data.location);
    data.locations?.forEach((el: any) => {
        const l = el.location;
        if (l) {
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
        if (c) {
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

    vcalendar.addSubcomponent(vevent);

    const icsContent = vcalendar.toString();

    return new Response(new Uint8Array(Buffer.from(icsContent)), {
        headers: {
            'Content-Type': 'text/calendar',
            'Content-Disposition': `attachment; filename="${data.summary.replace(/\s+/g, '_')}.ics"`,
            'Cache-Control': 'public, max-age=60'
        }
    });
};
