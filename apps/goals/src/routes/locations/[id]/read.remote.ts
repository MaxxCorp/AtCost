import { query } from '$app/server';
import { getLocationById } from '@ac/db';
import * as v from 'valibot';
import { cached, cacheKeys } from '#lib/server/cache/index.js';

export const readLocation = query(v.string(), async (id: string) => {
	return cached(cacheKeys.location(id), 600, async () => {
		return await getLocationById(id);
	});
});
