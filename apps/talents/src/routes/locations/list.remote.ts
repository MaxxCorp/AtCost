import { query } from '$app/server';
import { listLocations as queryLocations } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { LocationPaginationSchema as PaginationSchema, type Location, type PaginatedResult } from '@ac/validations';
import { cached, getNamespaceVersion, CACHE_NAMESPACES, cacheKeys, hashParams } from '#lib/server/cache/index.js';

/**
 * Query: List all locations
 */
export const listLocations = query(PaginationSchema, async (input): Promise<PaginatedResult<Location>> => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'locations');

	const version = await getNamespaceVersion(CACHE_NAMESPACES.LOCATIONS);
	const key = cacheKeys.locationsList(version, hashParams(input));

	return cached(key, 300, async () => {
		return await queryLocations(input);
	});
});
