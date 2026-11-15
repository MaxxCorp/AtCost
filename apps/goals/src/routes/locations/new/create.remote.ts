import { form, requested } from '$app/server';
import { createLocation as insertLocation } from '@ac/db';
import { listLocations } from '../list.remote';
import { getAuthenticatedUser } from '#lib/server/authorization.js';
import { createLocationSchema } from '@ac/validations';
import { invalidateLocation } from '#lib/server/cache/index.js';

export const createLocation = form(createLocationSchema, async (data) => {
    try {
        const user = getAuthenticatedUser();

        const newLocation = await insertLocation(data, user.id);
        await invalidateLocation(newLocation.id);

        try {
            await requested(listLocations, 20).refreshAll();
        } catch { /* ignore */ }
        void listLocations().refresh();
        void listLocations({}).refresh();

        return { success: true, location: newLocation, id: newLocation.id };
    } catch (err: any) {
        return { success: false, error: { message: err.message || 'Creation failed' } };
    }
});
