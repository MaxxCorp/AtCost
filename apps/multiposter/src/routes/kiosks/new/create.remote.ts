import { form } from '$app/server';
import { db } from '@ac/db';
import { kiosk, kioskLocation } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { createKioskSchema } from '$lib/validations/kiosks';
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

export const createKiosk = form(createKioskSchema, async (data) => {
    try {
        const user = getAuthenticatedUser();
        ensureAccess(user, 'kiosks');

        const { lookAheadDays = 28, lookPastDays = 0, startDate, endDate, locationIds: _, ...rest } = data;

        const isFixed = rest.rangeMode === 'fixed';
        let parsedStart: Date | null = null;
        let parsedEnd: Date | null = null;

        if (isFixed) {
            parsedStart = parseSafeDate(startDate);
            parsedEnd = parseSafeDate(endDate);

            if (!parsedStart || !parsedEnd) {
                return { success: false, error: 'Start date and end date are required for fixed range mode' };
            }

            if (parsedStart.getTime() > parsedEnd.getTime()) {
                return { success: false, error: 'Start date must be before or equal to end date' };
            }
        }

        const parseJsonArray = (val: any) => typeof val === 'string' ? JSON.parse(val) : val;

        const [newKiosk] = await db.insert(kiosk).values({
            ...rest,
            excludedEventIds: parseJsonArray(rest.excludedEventIds),
            includedEventIds: parseJsonArray(rest.includedEventIds),
            excludedAnnouncementIds: parseJsonArray(rest.excludedAnnouncementIds),
            includedAnnouncementIds: parseJsonArray(rest.includedAnnouncementIds),
            excludedTags: parseJsonArray(rest.excludedTags),
            includedTags: parseJsonArray(rest.includedTags),
            lookAhead: Math.round(Number(lookAheadDays) * 86400),
            lookPast: Math.round(Number(lookPastDays) * 86400),
            startDate: isFixed ? parsedStart : null,
            endDate: isFixed ? parsedEnd : null,
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
