import { command } from '$app/server';
import { db, location, inArray } from '$lib/server/db';
import { listLocations } from '../list.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';

export const deleteLocation = command(v.array(v.string()), async (ids: string[]) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'locations');

    await db.delete(location).where(inArray(location.id, ids));
    listLocations().refresh();
    return { success: true };
});
