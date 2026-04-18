import { command } from '$app/server';
import { db, contact } from '$lib/server/db';
import { inArray } from '$lib/server/db';
import { listContacts } from '../list.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';

export const deleteExistingContact = command(v.array(v.string()), async (ids): Promise<{ success: boolean }> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contacts');

    await db.delete(contact).where(inArray(contact.id, ids));
    return { success: true };
});
