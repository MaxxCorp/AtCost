import { query } from '$app/server';
import { getLocationById } from '@ac/db';
import * as v from 'valibot';
import { getAuthenticatedUser, ensureOperator } from '#lib/server/authorization.js';
import { cached, cacheKeys } from '#lib/server/cache/index.js';

export const readLocation = query(v.string(), async (id: string) => {
	const user = getAuthenticatedUser();
	ensureOperator(user);

	return cached(cacheKeys.location(id), 600, async () => {
		return await getLocationById(id);
	});
});
