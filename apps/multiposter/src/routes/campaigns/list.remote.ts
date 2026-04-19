import * as v from 'valibot';
import { query } from '$app/server';
import { campaign } from '@ac/db';
import type { Campaign as DbCampaign } from '@ac/db';
import { db } from '$lib/server/db';
import { desc } from 'drizzle-orm';
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

	const { page = 1, limit = 50, search = '' } = input || {};
	const offset = (page - 1) * limit;

	let baseQuery = db.select().from(campaign).$dynamic();
	
	const conditions = [];
	if (search) {
		const { ilike } = await import('drizzle-orm');
		conditions.push(ilike(campaign.name, `%${search}%`));
	}

	if (conditions.length > 0) {
		const { and } = await import('drizzle-orm');
		baseQuery = baseQuery.where(and(...conditions as any)) as any;
	}

	const { sql } = await import('drizzle-orm');
	const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
	const total = Number(countResult[0]?.count || 0);

	const rawResults = await baseQuery
		.orderBy(desc(campaign.createdAt))
		.limit(limit)
		.offset(offset);

	const data = rawResults.map((row) => ({
		...row,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	}));

	return { data, total };
});
