import { form, requested } from '$app/server';
import { updateLocation as updateLocationRecord } from '@ac/db';
import { listLocations } from '../list.remote';
import { readLocation } from './read.remote';
import { getAuthenticatedUser } from '#lib/server/authorization.js';
import { updateLocationSchema } from '@ac/validations';
import { invalidateLocation } from '#lib/server/cache/index.js';

export const updateLocation = form(updateLocationSchema, async (data) => {
    try {
        getAuthenticatedUser();

        const updated = await updateLocationRecord(data.id, data);
        readLocation(data.id).set(updated);
        await invalidateLocation(data.id);

        try {
            await requested(listLocations, 20).refreshAll();
        } catch { /* ignore */ }
        void listLocations().refresh();
        void listLocations({}).refresh();

        return { success: true, location: updated };
    } catch (err: any) {
        return { success: false, error: { message: err.message || 'Update failed' } };
    }
});
