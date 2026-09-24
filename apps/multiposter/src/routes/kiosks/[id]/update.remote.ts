import { form } from '$app/server';
import { db } from '@ac/db';
import { kiosk, kioskLocation } from '@ac/db';
import { eq, and } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { updateKioskSchema } from '$lib/validations/kiosks';
import { getKiosk } from './read.remote';
import { listKiosks } from '../list.remote';
import { error } from '@sveltejs/kit';

function parseSafeDate(val: string | null | undefined): Date | null {
    if (!val || typeof val !== 'string' || val.trim() === '') return null;
    const d = new Date(val);
    if (isNaN(d.getTime())) {
        throw new Error(`Invalid date value: "${val}"`);
    }
    const year = d.getFullYear();
    if (year < 1970 || year > 2100) {
        throw new Error(`Date year out of valid range (1970-2100): ${year}`);
    }
    try {
        d.toISOString();
    } catch {
        throw new Error(`Invalid time value: "${val}"`);
    }
    return d;
}

export const updateKiosk = form(updateKioskSchema, async (data) => {
    try {
        const user = getAuthenticatedUser();
        ensureAccess(user, 'kiosks');

        const { id, lookAheadDays, lookPastDays, startDate, endDate, locationIds: _, ...updates } = data;

        const dbUpdates: any = { ...updates };
        const parseJsonArray = (val: any) => typeof val === 'string' ? JSON.parse(val) : val;
        
        if (updates.excludedEventIds !== undefined) dbUpdates.excludedEventIds = parseJsonArray(updates.excludedEventIds);
        if (updates.includedEventIds !== undefined) dbUpdates.includedEventIds = parseJsonArray(updates.includedEventIds);
        if (updates.excludedAnnouncementIds !== undefined) dbUpdates.excludedAnnouncementIds = parseJsonArray(updates.excludedAnnouncementIds);
        if (updates.includedAnnouncementIds !== undefined) dbUpdates.includedAnnouncementIds = parseJsonArray(updates.includedAnnouncementIds);
        if (updates.excludedTags !== undefined) dbUpdates.excludedTags = parseJsonArray(updates.excludedTags);
        if (updates.includedTags !== undefined) dbUpdates.includedTags = parseJsonArray(updates.includedTags);

        if (lookAheadDays !== undefined) dbUpdates.lookAhead = Math.round(Number(lookAheadDays) * 86400);
        if (lookPastDays !== undefined) dbUpdates.lookPast = Math.round(Number(lookPastDays) * 86400);

        if (updates.rangeMode === 'rolling') {
            dbUpdates.startDate = null;
            dbUpdates.endDate = null;
        } else {
            if (startDate !== undefined) {
                dbUpdates.startDate = parseSafeDate(startDate);
            }
            if (endDate !== undefined) {
                dbUpdates.endDate = parseSafeDate(endDate);
            }
            if (updates.rangeMode === 'fixed' || (dbUpdates.startDate && dbUpdates.endDate)) {
                if (dbUpdates.startDate && dbUpdates.endDate && dbUpdates.startDate.getTime() > dbUpdates.endDate.getTime()) {
                    return { success: false, error: 'Start date must be before or equal to end date' };
                }
            }
        }

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
        await listKiosks().refresh();
        return { success: true };
    } catch (e: any) {
        console.error('Failed to update kiosk', e);
        return { success: false, error: e.message };
    }
});
