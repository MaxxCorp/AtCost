import { form } from '$app/server';
import { db } from '@ac/db';
import { kiosk, kioskLocation } from '@ac/db';
import { eq, and } from 'drizzle-orm';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { updateKioskSchema } from '$lib/validations/kiosks';
import { getKiosk } from './read.remote';
import { listKiosks } from '../list.remote';
import { error } from '@sveltejs/kit';

export const updateKiosk = form(updateKioskSchema, async (data) => {
    try {
        const user = getAuthenticatedUser();
        ensureAccess(user, 'kiosks');

        const { id, lookAheadDays, lookPastDays, startDate, endDate, locationIds: _, ...updates } = data;

        const dbUpdates: any = { ...updates };
        if (lookAheadDays !== undefined) dbUpdates.lookAhead = Math.round(lookAheadDays * 86400);
        if (lookPastDays !== undefined) dbUpdates.lookPast = Math.round(lookPastDays * 86400);
        if (startDate !== undefined) dbUpdates.startDate = startDate ? new Date(startDate) : null;
        if (endDate !== undefined) dbUpdates.endDate = endDate ? new Date(endDate) : null;

        const [updated] = await db.update(kiosk)
            .set({
                ...dbUpdates,
                updatedAt: new Date()
            })
            .where(eq(kiosk.id, id))
            .returning();

        if (!updated) {
            error(404, 'Kiosk not found');
        }

        // Update Locations if provided
        let locationIds: string[] = [];
        if (data.locationIds !== undefined) {
            locationIds = typeof data.locationIds === 'string' ? JSON.parse(data.locationIds) : data.locationIds;
            // Delete existing
            await db.delete(kioskLocation).where(eq(kioskLocation.kioskId, id));
            // Insert new
            if (locationIds && Array.isArray(locationIds) && locationIds.length > 0) {
                await db.insert(kioskLocation).values(
                    (locationIds as string[]).map((locationId: string) => ({
                        kioskId: id,
                        locationId,
                    }))
                );
            }
        }

        // Refresh caches - Fetch the full state to ensure absolute consistency and avoid partial state wiping
        getKiosk(id).set({ ...updated, locationIds });
        void listKiosks().refresh();


        return { success: true };
    } catch (e: any) {
        console.error('Failed to update kiosk', e);
        return { success: false, error: e.message };
    }
});
