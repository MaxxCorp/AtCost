import * as v from 'valibot';
import { query } from '$app/server';
import { syncConfig } from '@ac/db';
import type { SyncConfig as DbSyncConfig } from '@ac/db';
import { db } from '@ac/db';
import { desc, and, or, ilike, sql, inArray } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';

import { synchronizationPaginationSchema as PaginationSchema, type Synchronization, type PaginatedResult } from '@ac/validations';

/**
 * Query: List all synchronizations
 */
export const list = query(PaginationSchema, async (input: v.InferOutput<typeof PaginationSchema>): Promise<PaginatedResult<Synchronization>> => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'synchronizations', 'use');

	const { page = 1, limit = 50, search = '', providerType, sortField = 'createdAt', sortOrder = 'desc' } = input || {};
	const offset = (page - 1) * limit;

	let baseQuery = db.select().from(syncConfig).$dynamic();
	
	const conditions = [];
	if (search) {
		const { ilike, or } = await import('@ac/db');
		conditions.push(or(
			ilike(syncConfig.name, `%${search}%`),
			ilike(syncConfig.providerType, `%${search}%`)
		));
	}

	if (providerType) {
		const ids = Array.isArray(providerType) ? providerType : [providerType];
		if (ids.length > 0) {
			conditions.push(inArray(syncConfig.providerType, ids));
		}
	}

	if (conditions.length > 0) {
		baseQuery = baseQuery.where(and(...conditions as any)) as any;
	}

	const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
	const total = Number(countResult[0]?.count || 0);

	let orderField: any = syncConfig.createdAt;
	if (sortField === 'updatedAt') orderField = syncConfig.updatedAt;
	else if (sortField === 'name') orderField = syncConfig.name;

	const orderExpression = sortOrder === 'desc' ? sql`${orderField} desc nulls last` : sql`${orderField} asc nulls last`;

	const rawResults = await baseQuery
		.orderBy(orderExpression)
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
	})) as any as Synchronization[]; // Using Synchronization[] which now has string dates


	return { data, total };
});
