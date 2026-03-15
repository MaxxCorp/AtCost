import { command } from '$app/server';
import { db } from '$lib/server/db';
import { contact } from '$lib/server/db/schema';
import { inArray } from 'drizzle-orm';
import { listContacts } from '../list.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';

export const deleteExistingContact = command(v.array(v.string()), async (ids: string[]) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contacts');

    await db.delete(contact).where(inArray(contact.id, ids));
    await listContacts().refresh();
    return { success: true };
});
