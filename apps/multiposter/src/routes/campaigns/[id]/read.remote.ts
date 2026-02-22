import { query } from '$app/server';
import { db } from '$lib/server/db';
import { campaign } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { Campaign as DbCampaign } from '$lib/server/db/schema';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';

export type Campaign = Omit<DbCampaign, 'createdAt' | 'updatedAt'> & {
	createdAt: string;
	updatedAt: string;
};

/**
 * Query: Read a campaign by ID
 */
export const readCampaign = query(v.string(), async (campaignId: string): Promise<Campaign | null> => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'campaigns');

	const [result] = await db
		.select()
		.from(campaign)
		.where(eq(campaign.id, campaignId));

	if (!result) return null;

	return {
		...result,
		createdAt: result.createdAt.toISOString(),
		updatedAt: result.updatedAt.toISOString(),
	};
});
