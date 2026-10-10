import { command, requested } from '$app/server';
import { deleteLocations } from '@ac/db';
import { listLocations } from '../list.remote';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import * as v from 'valibot';
import { invalidateLocation, invalidateAllKioskViews } from '#lib/server/cache/index.js';

export const deleteLocation = command(v.array(v.string()), async (ids: string[]) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'locations');

    await deleteLocations(ids);
    await invalidateLocation(ids);
    await invalidateAllKioskViews();

    try {
        await requested(listLocations, 20).refreshAll();
    } catch { /* ignore */ }
    void listLocations().refresh();
    void listLocations({}).refresh();

    return { success: true };
});
