import { query } from '$app/server';
import { getContactById } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import * as v from 'valibot';
import { cached, cacheKeys } from '#lib/server/cache/index.js';

export const readContact = query(v.string(), async (id: string) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contacts');

    return cached(cacheKeys.contact(id), 600, async () => {
        return await getContactById(id);
    });
});
