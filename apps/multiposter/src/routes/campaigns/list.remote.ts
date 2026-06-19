import * as v from 'valibot';
import { query } from '$app/server';
import { campaign } from '@ac/db';
import type { Campaign as DbCampaign } from '@ac/db';
import { db } from '@ac/db';
import { desc } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';

/**
 * Campaign interface matching the database schema, with dates serialized to strings
 */
import { PaginationSchema, type Campaign, type PaginatedResult } from '@ac/validations';



/**
 * Query: List all campaigns
 */
export const listCampaigns = query(PaginationSchema, async (input): Promise<PaginatedResult<Campaign>> => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'campaigns');

	const { page = 1, limit = 50, search = '', sortField = 'updatedAt', sortOrder = 'desc' } = input || {};
	const offset = (page - 1) * limit;

	let baseQuery = db.select({ id: campaign.id }).from(campaign).$dynamic();
	
	const conditions = [];
	if (search) {
		const { ilike } = await import('@ac/db');
		conditions.push(ilike(campaign.name, `%${search}%`));
	}

	if (conditions.length > 0) {
		const { and } = await import('@ac/db');
		baseQuery = baseQuery.where(and(...conditions as any)) as any;
	}

	const { sql } = await import('@ac/db');
	const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
	const total = Number(countResult[0]?.count || 0);

    if (total === 0) {
        return { data: [], total: 0 };
    }

    let orderField: any = campaign.updatedAt;
	if (sortField === 'name') orderField = campaign.name;
	else if (sortField === 'createdAt') orderField = campaign.createdAt;

	const orderExpression = sortOrder === 'desc' ? sql`${orderField} desc nulls last` : sql`${orderField} asc nulls last`;

	const paginatedIdsQuery = baseQuery.orderBy(orderExpression).limit(limit).offset(offset);
    const ids = (await paginatedIdsQuery).map((r: any) => r.id);

    if (ids.length === 0) {
        return { data: [], total };
    }

	const { inArray } = await import('@ac/db');
    const rawResults = await db.query.campaign.findMany({
        where: inArray(campaign.id, ids),
        with: { user: true },
        orderBy: [orderExpression]
    });

	const data = rawResults.map((row) => ({
		...row,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	}));

	return { data, total };
});
