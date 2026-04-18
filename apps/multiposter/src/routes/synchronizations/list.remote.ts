import * as v from 'valibot';
import { query } from '$app/server';
import { syncConfig } from '@ac/db';
import type { SyncConfig as DbSyncConfig } from '@ac/db';
import { db } from '$lib/server/db';
import { desc } from 'drizzle-orm';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';

/**
 * Synchronization interface matching the database schema, with dates serialized to strings
 */
export type Synchronization = Omit<DbSyncConfig, 'createdAt' | 'updatedAt'> & {
	createdAt: string;
	updatedAt: string;
};

/**
 * Query: List all synchronizations
 */
export const list = query(v.undefined_(), async (): Promise<Synchronization[]> => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'synchronizations');

	const rawResults = await db
		.select()
		.from(syncConfig)
		.orderBy(desc(syncConfig.createdAt));

	return rawResults.map((row) => ({
		...row,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	}));
});
