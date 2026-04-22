import { db } from '../db';
import { event as eventTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import QRCode from 'qrcode';
import ICAL from 'ical.js';
import { getStorageProvider } from '../blob-storage';
import { env } from '$env/dynamic/private';
import { createHash } from 'crypto';

function getFingerprint(content: string | Buffer): string {
    return createHash('sha256').update(content).digest('hex');
}

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

    const storage = getStorageProvider();
    const summarySlug = data.summary.replace(/\s+/g, '_');

    const oldICalPath = data.iCalPath;
    const oldQRCodePath = data.qrCodePath;
    const fingerprints = (data.fingerprints as Record<string, string>) || {};
    const newFingerprints = { ...fingerprints };

    // iCal Generation & Upload
    const iCalContent = vcalendar.toString();
    const iCalFingerprint = getFingerprint(iCalContent);
    const iCalFileName = `events/${eventId}/${summarySlug}.ics`;
    
    let iCalUrl = oldICalPath;
    // Only upload if content changed OR filename (path) changed
    if (iCalFingerprint !== fingerprints.ical || !oldICalPath || !oldICalPath.includes(summarySlug)) {
        iCalUrl = (await storage.put(iCalFileName, iCalContent, 'text/calendar')) ?? null;
        newFingerprints.ical = iCalFingerprint;
    }

    // QR Code generation — resolve base URL with multiple fallbacks
    const baseUrl = env.PUBLIC_BASE_URL || origin || env.BETTER_AUTH_URL || "";
    const eventUrl = `${baseUrl}/events/${eventId}/view`;
    const eventUrlFingerprint = getFingerprint(eventUrl);

    let qrCodeUrl = oldQRCodePath;
    // Only generate and upload QR if URL changed (or path missing)
    if (eventUrlFingerprint !== fingerprints.qrcode || !oldQRCodePath) {
        // Generate QR as Buffer
        const qrBuffer = await QRCode.toBuffer(eventUrl, {
            width: 300,
            margin: 2,
            color: {
                dark: '#1e40af', // blue-800
                light: '#ffffff'
            }
        });

        const qrCodeFileName = `events/${eventId}/qr.png`;
        qrCodeUrl = (await storage.put(qrCodeFileName, qrBuffer, 'image/png')) ?? null;
        newFingerprints.qrcode = eventUrlFingerprint;
    }

    // Update paths and fingerprints in DB
    const updateData: any = {};
    if (iCalUrl && iCalUrl !== oldICalPath) updateData.iCalPath = iCalUrl;
    if (qrCodeUrl && qrCodeUrl !== oldQRCodePath) updateData.qrCodePath = qrCodeUrl;
    if (JSON.stringify(newFingerprints) !== JSON.stringify(fingerprints)) {
        updateData.fingerprints = newFingerprints;
    }

    if (Object.keys(updateData).length > 0) {
        await db.update(eventTable)
            .set(updateData)
            .where(eq(eventTable.id, eventId));
    }

    // Clean up old assets if paths changed
    if (oldICalPath && iCalUrl && oldICalPath !== iCalUrl) {
        await storage.delete(oldICalPath);
    }
    if (oldQRCodePath && qrCodeUrl && oldQRCodePath !== qrCodeUrl) {
        await storage.delete(oldQRCodePath);
    }
}
