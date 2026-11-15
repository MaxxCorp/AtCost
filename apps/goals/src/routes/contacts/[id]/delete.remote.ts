import { command, requested } from '$app/server';
import * as v from 'valibot';
import { deleteContacts } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { listContacts } from '../list.remote';

export const deleteContact = command(v.array(v.string()), async (ids: string[]) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contacts');
    const res = await deleteContacts(ids);

    try {
        await requested(listContacts, 20).refreshAll();
    } catch {
        // ignore
    }
    void listContacts().refresh();
    void listContacts({}).refresh();
    return res;
});
