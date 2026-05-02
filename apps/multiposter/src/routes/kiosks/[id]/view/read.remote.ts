import { query } from '$app/server';
import { listEvents } from '../../../events/events.remote';
import { listKioskAnnouncements } from '../../../announcements/list.remote';
import { db } from '@ac/db';
import { kiosk, kioskLocation, location } from '@ac/db';
import { eq } from 'drizzle-orm';
import * as v from 'valibot';

export const readKioskView = query(v.string(), async (kioskId) => {
    const kioskData = await db.query.kiosk.findFirst({
        where: eq(kiosk.id, kioskId),
    });

    if (!kioskData) return null;

    const locations = await db
        .select({
            id: location.id,
            name: location.name,
            street: location.street,
            houseNumber: location.houseNumber,
            zip: location.zip,
            city: location.city,
            country: location.country
        })
        .from(kioskLocation)
        .innerJoin(location, eq(kioskLocation.locationId, location.id))
        .where(eq(kioskLocation.kioskId, kioskId));

    const kioskWithLocations = {
        ...kioskData,
        locations: locations
    };

    const eventsResponse = await listEvents({ 
        locationId: locations.map(l => l.id), 
        page: 1, 
        limit: 1000 
    } as any);
    const eventsResult = eventsResponse.data;
    const announcementsResult = await listKioskAnnouncements();

    const items = [...eventsResult, ...announcementsResult.data].sort((a, b) => {
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    });

    return {
        kiosk: kioskWithLocations,
        items
    };
});
