import { query } from '$app/server';
import { listContacts as queryContacts } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { contactPaginationSchema as PaginationSchema, type Contact, type PaginatedResult } from '@ac/validations';
import { cached, getNamespaceVersion, CACHE_NAMESPACES, cacheKeys, hashParams } from '#lib/server/cache/index.js';

/**
 * Query: List all contacts
 */
export const listContacts = query(PaginationSchema, async (input): Promise<PaginatedResult<Contact>> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contacts');

    const version = await getNamespaceVersion(CACHE_NAMESPACES.CONTACTS);
    const key = cacheKeys.contactsList(version, hashParams(input));

    return cached(key, 300, async () => {
        return (await queryContacts(input)) as unknown as PaginatedResult<Contact>;
    });
});
