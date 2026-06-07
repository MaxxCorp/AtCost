import { db } from '@ac/db';
import { event as eventTable } from '@ac/db';
import { eq } from '@ac/db';
import QRCode from 'qrcode';
import ICAL from 'ical.js';

/**
 * Generate iCal and QR Code for an event
 */
export async function generateEventAssets(eventId: string, origin?: string) {
    // Resolve origin from request context if not provided (matches contact generation pattern)
    if (!origin) {
        try {
            const { getRequestEvent } = await import('$app/server');
            origin = getRequestEvent()?.url.origin;
        } catch (e) { /* not in request context (e.g. sync service) — ignore */ }
    }

    const data = await db.query.event.findFirst({
        where: (table, { eq }) => eq(table.id, eventId),
        with: {
            locations: {
                with: {
                    location: true
                }
            },
            contacts: {
                with: {
                    contact: true
                }
            }
        }
    });

    if (!data) return;

    // iCal generation using ical.js
    const vcalendar = new ICAL.Component(['vcalendar', [], []]);
    vcalendar.addPropertyWithValue('prodid', '-//MaxxCorp//ac-multiposter//EN');
    vcalendar.addPropertyWithValue('version', '2.0');

    const vevent = new ICAL.Component('vevent');

    vevent.addPropertyWithValue('uid', data.iCalUID || eventId);
    vevent.addPropertyWithValue('summary', data.summary);
    if (data.description) vevent.addPropertyWithValue('description', data.description);
    
    // Build location string from associations and free text
    const locationParts: string[] = [];
    // data.location is removed
    
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

    // Add attendees from associations
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

    // Handle dates
    if (data.startDateTime) {
        vevent.addPropertyWithValue('dtstart', ICAL.Time.fromJSDate(data.startDateTime, true));
    }

    if (data.endDateTime) {
        vevent.addPropertyWithValue('dtend', ICAL.Time.fromJSDate(data.endDateTime, true));
    }

    // Use updatedAt for DTSTAMP to ensure stable fingerprints when data doesn't change
    vevent.addPropertyWithValue('dtstamp', ICAL.Time.fromJSDate(data.updatedAt, true));

    vcalendar.addSubcomponent(vevent);

    const iCalUrl = `/api/events/${eventId}/event.ics`;
    const qrCodeUrl = `/api/events/${eventId}/qr.png`;

    // Update paths in DB if they are not already set to the local API paths
    const updateData: any = {};
    if (data.iCalPath !== iCalUrl) updateData.iCalPath = iCalUrl;
    if (data.qrCodePath !== qrCodeUrl) updateData.qrCodePath = qrCodeUrl;

    if (Object.keys(updateData).length > 0) {
        await db.update(eventTable)
            .set(updateData)
            .where(eq(eventTable.id, eventId));
    }

}
