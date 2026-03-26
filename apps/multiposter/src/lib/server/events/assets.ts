import { db } from '../db';
import { event as eventTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import QRCode from 'qrcode';
import ICAL from 'ical.js';
import { getStorageProvider } from '../blob-storage';
import { env } from '$env/dynamic/private';

/**
 * Generate iCal and QR Code for an event
 */
export async function generateEventAssets(eventId: string, origin?: string) {
    const data = await db.query.event.findFirst({
        where: (table, { eq }) => eq(table.id, eventId),
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
    if (data.location) vevent.addPropertyWithValue('location', data.location);

    // Handle dates
    if (data.startDateTime) {
        vevent.addPropertyWithValue('dtstart', ICAL.Time.fromJSDate(data.startDateTime, true));
    }

    if (data.endDateTime) {
        vevent.addPropertyWithValue('dtend', ICAL.Time.fromJSDate(data.endDateTime, true));
    }

    vevent.addPropertyWithValue('dtstamp', ICAL.Time.fromJSDate(new Date(), true));

    vcalendar.addSubcomponent(vevent);

    const storage = getStorageProvider();
    
    // Create a robust slug for the summary
    const summarySlug = data.summary
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

    const oldICalPath = data.iCalPath;
    const oldQRCodePath = data.qrCodePath;

    // Use a timestamp in the filename for cache busting
    const timestamp = Date.now();

    // iCal Upload
    const iCalFileName = `events/${eventId}/event_${timestamp}.ics`;
    const iCalUrl = await storage.put(iCalFileName, vcalendar.toString(), 'text/calendar');

    // QR Code generation

    let baseUrl = env.PUBLIC_BASE_URL || origin || "";
    
    // Fallback if still empty
    if (!baseUrl) {
        baseUrl = env.BETTER_AUTH_URL || "";
    }

    if (!baseUrl) {
        console.warn(`[Assets] No PUBLIC_BASE_URL, BETTER_AUTH_URL or derivation origin found for event ${eventId}. QR code will have relative URL.`);
    } else {
        console.log(`[Assets] Using baseUrl: ${baseUrl} for event ${eventId}`);
    }

    const safeBaseUrl = baseUrl ? (baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl) : "";
    const eventUrl = safeBaseUrl ? `${safeBaseUrl}/events/${eventId}/view` : `/events/${eventId}/view`;

    // Generate QR as Buffer
    const qrBuffer = await QRCode.toBuffer(eventUrl, {
        width: 300,
        margin: 2,
        color: {
            dark: '#1e40af', // blue-800
            light: '#ffffff'
        }
    });

    const qrCodeFileName = `events/${eventId}/qr_${timestamp}.png`;
    const qrCodeUrl = await storage.put(qrCodeFileName, qrBuffer, 'image/png');

    // Update paths in DB
    await db.update(eventTable)
        .set({
            iCalPath: iCalUrl,
            qrCodePath: qrCodeUrl
        })
        .where(eq(eventTable.id, eventId));

    // Clean up old assets if paths changed
    if (oldICalPath && oldICalPath !== iCalUrl) {
        await storage.delete(oldICalPath);
    }
    if (oldQRCodePath && oldQRCodePath !== qrCodeUrl) {
        await storage.delete(oldQRCodePath);
    }
}
