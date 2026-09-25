import { query } from '$app/server';
import { db } from '@ac/db';
import { location } from '@ac/db';
import { eq, and } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';
import { cached, cacheKeys } from '$lib/server/cache';

export const readLocation = query(v.string(), async (id: string) => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'locations');

	return cached(cacheKeys.location(id), 600, async () => {
		const [result] = await db
			.select()
			.from(location)
			.where(eq(location.id, id));
		return result || null;
	});
});

