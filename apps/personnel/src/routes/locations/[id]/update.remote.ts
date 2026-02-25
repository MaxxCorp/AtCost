import { form } from '$app/server';
import { db } from '$lib/server/db';
import { location } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { listLocations } from '../list.remote';
import { readLocation } from './read.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { updateLocationSchema } from '@ac/validations/locations';

export const updateLocation = form(updateLocationSchema, async (data) => {
    try {
        const user = getAuthenticatedUser();
        ensureAccess(user, 'locations');

        const updateData: any = {
            name: data.name,
            street: data.street || null,
            houseNumber: data.houseNumber || null,
            addressSuffix: data.addressSuffix || null,
            zip: data.zip || null,
            city: data.city || null,
            state: data.state || null,
            country: data.country || null,
            roomId: data.roomId || null,
            latitude: data.latitude ? parseFloat(data.latitude) : null,
            longitude: data.longitude ? parseFloat(data.longitude) : null,
            what3words: data.what3words || null,
            inclusivitySupport: data.inclusivitySupport || null,
            updatedAt: new Date(),
        };

        if (updateData.latitude && isNaN(updateData.latitude)) updateData.latitude = null;
        if (updateData.longitude && isNaN(updateData.longitude)) updateData.longitude = null;

        const result = await db.update(location)
            .set(updateData)
            .where(eq(location.id, data.id))
            .returning();

        if (result.length === 0) {
            return { success: false, error: { message: 'Location not found' } };
        }

        await readLocation(data.id).refresh();
        await listLocations().refresh();

        return { success: true, location: result[0] };
    } catch (err: any) {
        console.error('updateLocation ERROR:', err);
        return { success: false, error: { message: err.message || 'Update failed' } };
    }
});
