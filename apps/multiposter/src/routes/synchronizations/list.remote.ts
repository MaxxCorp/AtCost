import * as v from 'valibot';
import { query } from '$app/server';
import { syncConfig } from '@ac/db';
import type { SyncConfig as DbSyncConfig } from '@ac/db';
import { db } from '@ac/db';
import { desc, and, or, not, ilike, sql, inArray, notInArray } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';

import { synchronizationPaginationSchema as PaginationSchema, parseFilterValue, type Synchronization, type PaginatedResult } from '@ac/validations';

/**
 * Query: List all synchronizations
 */
export const list = query(PaginationSchema, async (input: v.InferOutput<typeof PaginationSchema>): Promise<PaginatedResult<Synchronization>> => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'synchronizations', 'use');

	const { page = 1, limit = 50, search = '', providerType, status, sortField = 'createdAt', sortOrder = 'desc' } = input || {};
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
		const { include, exclude } = parseFilterValue(providerType);
		if (include.length > 0) {
			conditions.push(inArray(syncConfig.providerType, include));
		}
		if (exclude.length > 0) {
			conditions.push(notInArray(syncConfig.providerType, exclude));
		}
	}

	if (status) {
		const { include, exclude } = parseFilterValue(status);
		if (include.length > 0) {
			conditions.push(inArray(syncConfig.status, include));
		}
		if (exclude.length > 0) {
			conditions.push(notInArray(syncConfig.status, exclude));
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

	const paginatedIdsQuery = baseQuery
		.orderBy(orderExpression)
		.limit(limit)
		.offset(offset);
	const paginatedIds = (await paginatedIdsQuery).map((r) => r.id);

	if (paginatedIds.length === 0) {
		return { data: [], total: 0 };
	}

	const rawResults = await db.query.syncConfig.findMany({
		where: inArray(syncConfig.id, paginatedIds),
		with: { user: true },
		orderBy: [orderExpression]
	});

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
