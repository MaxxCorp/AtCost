import { query } from '$app/server';
import { db, location, eq } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';
import { cached, cacheKeys } from '$lib/server/cache';

export const readLocation = query(v.string(), async (id: string) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'locations');

    return cached(cacheKeys.location(id), 600, async () => {
        const result = await db.select().from(location).where(eq(location.id, id)).limit(1);
        if (result.length === 0) return null;
        return result[0];
    });
});

