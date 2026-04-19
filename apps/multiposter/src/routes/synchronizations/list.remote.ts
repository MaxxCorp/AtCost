import * as v from 'valibot';
import { query } from '$app/server';
import { syncConfig } from '@ac/db';
import type { SyncConfig as DbSyncConfig } from '@ac/db';
import { db } from '$lib/server/db';
import { desc } from 'drizzle-orm';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';



import { PaginationSchema, type Synchronization, type PaginatedResult } from '@ac/validations';


/**
 * Query: List all synchronizations
 */
export const list = query(PaginationSchema, async (input): Promise<PaginatedResult<Synchronization>> => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'synchronizations');

	const { page = 1, limit = 50, search = '' } = input || {};
	const offset = (page - 1) * limit;

	let baseQuery = db.select().from(syncConfig).$dynamic();
	
	const conditions = [];
	if (search) {
		const { ilike, or } = await import('drizzle-orm');
		conditions.push(or(
			ilike(syncConfig.name, `%${search}%`),
			ilike(syncConfig.providerType, `%${search}%`)

		));
	}

	if (conditions.length > 0) {
		const { and } = await import('drizzle-orm');
		baseQuery = baseQuery.where(and(...conditions as any)) as any;
	}

	const { sql } = await import('drizzle-orm');
	const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
	const total = Number(countResult[0]?.count || 0);

	const rawResults = await baseQuery
		.orderBy(desc(syncConfig.createdAt))
		.limit(limit)
		.offset(offset);

	const data = rawResults.map((row) => ({
		...row,
        providerId: row.providerId ?? undefined,
        syncToken: row.syncToken ?? undefined,
        webhookId: row.webhookId ?? undefined,
        credentials: row.credentials ?? undefined,
        settings: row.settings ?? undefined,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	})) as any as Synchronization[];


	return { data, total };
});
