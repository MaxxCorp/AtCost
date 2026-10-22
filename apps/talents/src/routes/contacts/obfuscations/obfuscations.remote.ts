import { query, command } from '$app/server';
import { gdprFilterSchema, executeObfuscationSchema } from '@ac/validations';
import { listGdprRequests as listGdprRequestsDb, obfuscateContact } from '@ac/db';
import { getAuthenticatedUser, parseRoles } from '#lib/server/authorization.js';
import { listTasks, listCompletedTasks } from '../../tasks.remote.js';
import * as v from 'valibot';

export const listGdprRequests = query(v.optional(gdprFilterSchema), async (input) => {
    const user = getAuthenticatedUser();
    const roles = parseRoles(user);
    const isAuthorized = roles.includes('admin') || roles.includes('hr_manager') || roles.includes('top_management');
    if (!isAuthorized) {
        throw new Error('Forbidden: Only Admins and HR Management can access GDPR obfuscations.');
    }

    return await listGdprRequestsDb(input || {});
});

export const executeGdprObfuscation = command(executeObfuscationSchema, async (data) => {
    const user = getAuthenticatedUser();
    const roles = parseRoles(user);
    const isAuthorized = roles.includes('admin') || roles.includes('hr_manager') || roles.includes('top_management');
    if (!isAuthorized) {
        throw new Error('Forbidden: Only Admins and HR Management can execute GDPR obfuscation.');
    }

    const result = await obfuscateContact(data.contactId, user.id, data.notes);

    void listGdprRequests().refresh();
    void listTasks().refresh();
    void listCompletedTasks().refresh();

    return result;
});
