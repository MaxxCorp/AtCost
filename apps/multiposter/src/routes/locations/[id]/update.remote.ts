import { form, requested } from '$app/server';
import { updateLocation as updateLocationRecord } from '@ac/db';
import { listLocations } from '../list.remote';
import { fetchEntityLocations } from '../associate.remote';
import { readLocation } from './read.remote';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { updateLocationSchema } from '@ac/validations';
import { invalidateLocation, invalidateAllKioskViews } from '#lib/server/cache/index.js';

export const updateLocation = form(updateLocationSchema, async (data) => {
    try {
        const user = getAuthenticatedUser();
        ensureAccess(user, 'locations');

        const updated = await updateLocationRecord(data.id, data);
        readLocation(data.id).set(updated);
        await invalidateLocation(data.id);
        await invalidateAllKioskViews();

        try {
            await requested(listLocations, 20).refreshAll();
            await requested(fetchEntityLocations, 20).refreshAll();
        } catch { /* ignore */ }
        void listLocations().refresh();
        void listLocations({}).refresh();

        return { success: true, location: updated, id: data.id };
    } catch (err: any) {
        return { success: false, error: { message: err.message || 'Update failed' } };
    }
});
