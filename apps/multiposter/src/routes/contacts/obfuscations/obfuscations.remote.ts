import { query, command } from '$app/server';
import { gdprFilterSchema, executeObfuscationSchema } from '@ac/validations';
import { listGdprRequests as listGdprRequestsDb, obfuscateContact } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
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

    void listGdprRequests().refresh();

    return result;
});
