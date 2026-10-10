import { query } from '$app/server';
import { getLocationById } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import * as v from 'valibot';
import { cached, cacheKeys } from '#lib/server/cache/index.js';

export const readLocation = query(v.string(), async (id: string) => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'locations');

	return cached(cacheKeys.location(id), 600, async () => {
		return await getLocationById(id);
	});
});
