import { query } from '$app/server';
import { listLocations as queryLocations } from '@ac/db';
import { LocationPaginationSchema as PaginationSchema, type Location, type PaginatedResult } from '@ac/validations';
import { cached, getNamespaceVersion, CACHE_NAMESPACES, cacheKeys, hashParams } from '#lib/server/cache/index.js';
import { ensureGoalsTablesAndSeed } from '#lib/server/goals/service.js';

export const listLocations = query(PaginationSchema, async (input): Promise<PaginatedResult<Location>> => {
	await ensureGoalsTablesAndSeed();

	const version = await getNamespaceVersion(CACHE_NAMESPACES.LOCATIONS);
	const key = cacheKeys.locationsList(version, hashParams(input));

	return cached(key, 300, async () => {
		return await queryLocations(input);
	});
});
