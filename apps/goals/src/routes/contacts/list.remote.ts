import { query } from '$app/server';
import { contactPaginationSchema, type Contact, type PaginatedResult } from '@ac/validations';
import { listContacts as listContactsFromDb } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { ensureGoalsTablesAndSeed } from '#lib/server/goals/service.js';

export const listContacts = query(contactPaginationSchema, async (input): Promise<PaginatedResult<Contact>> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contacts');
    await ensureGoalsTablesAndSeed();

    return (await listContactsFromDb(input as any)) as any;
});
