import { query } from '$app/server';
import { db } from '@ac/db';
import { location } from '@ac/db';
import { eq, and } from 'drizzle-orm';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';

export const readLocation = query(v.string(), async (id: string) => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'locations');

	const [result] = await db
		.select()
		.from(location)
		.where(eq(location.id, id));
	return result || null;
});
