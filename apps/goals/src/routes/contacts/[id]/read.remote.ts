import { query } from '$app/server';
import * as v from 'valibot';
import { getContactById } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';

export const readContact = query(v.string(), async (id: string) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contacts');
    return await getContactById(id);
});
