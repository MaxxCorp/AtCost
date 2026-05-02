import { form } from '$app/server';
import { db } from '@ac/db';
import { kiosk, kioskLocation } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { createKioskSchema } from '$lib/validations/kiosks';
import { listKiosks } from '../list.remote';
import { error } from '@sveltejs/kit';

export const createKiosk = form(createKioskSchema, async (data) => {
    try {
        const user = getAuthenticatedUser();
        ensureAccess(user, 'kiosks');

        const { lookAheadDays, lookPastDays, startDate, endDate, locationIds: _, ...rest } = data;

        const [newKiosk] = await db.insert(kiosk).values({
            ...rest,
            lookAhead: Math.round(lookAheadDays * 86400),
            lookPast: Math.round(lookPastDays * 86400),
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
            userId: user.id
        }).returning();

        if (!newKiosk) {
            error(500, 'Failed to create kiosk');
        }

        // Insert Locations
        const locationIds = typeof data.locationIds === 'string' ? JSON.parse(data.locationIds) : data.locationIds;
        if (locationIds && Array.isArray(locationIds) && locationIds.length > 0) {
            await db.insert(kioskLocation).values(
                (locationIds as string[]).map((locationId: string) => ({
                    kioskId: newKiosk.id,
                    locationId,
                }))
            );
        }

        await listKiosks().refresh();
        return { success: true, id: newKiosk.id };
    } catch (e: any) {
        console.error('Failed to create kiosk', e);
        return { success: false, error: e.message };
    }
});
