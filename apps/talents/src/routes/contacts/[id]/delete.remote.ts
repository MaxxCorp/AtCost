import * as v from 'valibot';
import { command, requested } from '$app/server';
import { deleteContacts } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { listContacts } from '../list.remote';
import { invalidateContact } from '#lib/server/cache/index.js';

const deleteContactsSchema = v.array(v.string());

export const deleteContact = command(deleteContactsSchema, async (ids) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contacts');

    if (!Array.isArray(ids) || ids.length === 0) return { count: 0 };

    const result = await deleteContacts(ids);
    await invalidateContact(ids);
    try {
        await requested(listContacts, 20).refreshAll();
    } catch { /* ignore */ }
    void listContacts().refresh();
    void listContacts({}).refresh();
    return result;
});
