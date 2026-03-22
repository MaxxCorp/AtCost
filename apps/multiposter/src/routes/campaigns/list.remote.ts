import { query } from '$app/server';
import { campaign } from '@ac/db';
import type { Campaign } from '@ac/db';
export type { Campaign };
import { listQuery } from '$lib/server/db/query-helpers';


/**
 * Query: List all campaigns
 */
export const listCampaigns = query(async (): Promise<Campaign[]> => {
	const results = await listQuery({
		table: campaign,
		featureName: 'campaigns',
		transform: (row) => ({
			...row,
		}),
	});
	return results;
});
