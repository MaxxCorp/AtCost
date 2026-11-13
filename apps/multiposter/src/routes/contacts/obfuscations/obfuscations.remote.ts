import { query, command, requested } from '$app/server';
import { gdprFilterSchema, executeObfuscationSchema } from '@ac/validations';
import { listGdprRequests as listGdprRequestsDb, obfuscateContact } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { invalidateContact } from '#lib/server/cache/index.js';
import { listContacts } from '../list.remote.js';
import { readContact } from '../[id]/read.remote.js';
import { fetchEntityContacts } from '../associate.remote.js';
import * as v from 'valibot';

export const listGdprRequests = query(v.optional(gdprFilterSchema), async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contacts');

    return await listGdprRequestsDb(input || {});
});

export const executeGdprObfuscation = command(executeObfuscationSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contacts');

    const result = await obfuscateContact(data.contactId, user.id, data.notes);

    await invalidateContact(data.contactId);

    try {
        await requested(listGdprRequests, 20).refreshAll();
        await requested(listContacts, 20).refreshAll();
        await requested(fetchEntityContacts, 20).refreshAll();
    } catch { /* ignore */ }

    void readContact(data.contactId).refresh();
    void listContacts().refresh();
    void listContacts({}).refresh();
    void listGdprRequests().refresh();
    void listGdprRequests({}).refresh();
    void listGdprRequests({ status: 'all' }).refresh();

    return result;
});
