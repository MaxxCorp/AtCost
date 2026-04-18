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
export type Campaign = Omit<DbCampaign, 'createdAt' | 'updatedAt'> & {
	createdAt: string;
	updatedAt: string;
};

/**
 * Query: List all campaigns
 */
export const listCampaigns = query(v.undefined_(), async (): Promise<Campaign[]> => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'campaigns');

	const rawResults = await db
		.select()
		.from(campaign)
		.orderBy(desc(campaign.createdAt));

	return rawResults.map((row) => ({
		...row,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	}));
});
