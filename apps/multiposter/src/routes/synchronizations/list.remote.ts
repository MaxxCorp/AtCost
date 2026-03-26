import { query } from '$app/server';
import { syncConfig } from '@ac/db';
import { listQuery } from '$lib/server/db/query-helpers';

/**
 * List all sync configurations for the current user
 */
export const list = query(async () => {
	const configs = await listQuery({
		table: syncConfig,
		featureName: 'synchronizations',
		accessLevel: 'use',
	});

	console.log('--- listSynchronizations returning ---', configs.length);
	return configs;
});
