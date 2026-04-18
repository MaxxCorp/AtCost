import * as v from 'valibot';
import { query } from '$app/server';
import { location } from '@ac/db';
import type { Location as DbLocation } from '@ac/db';
import { db } from '$lib/server/db';
import { desc } from 'drizzle-orm';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';

/**
 * Location interface matching the database schema, with dates serialized to strings
 */
export type Location = Omit<DbLocation, 'createdAt' | 'updatedAt'> & {
	createdAt: string;
	updatedAt: string;
};

/**
 * Query: List all locations
 */
export const listLocations = query(v.undefined_(), async (): Promise<Location[]> => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'locations');

	const rawResults = await db
		.select()
		.from(location)
		.orderBy(desc(location.createdAt));

	return rawResults.map((row) => ({
		...row,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	}));
});
