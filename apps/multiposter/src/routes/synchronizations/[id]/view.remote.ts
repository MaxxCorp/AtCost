import { query } from '$app/server';
import * as v from 'valibot';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { db, syncConfig, syncOperation, eq, and, desc, type SyncConfig, type SyncOperation } from '@ac/db';

/**
 * Query: Get a sync configuration and its recent logs
 */
export const view = query(v.string(), async (id: string): Promise<SyncConfig> => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'synchronizations', 'use');

	const [config] = await db
		.select()
		.from(syncConfig)
		.where(eq(syncConfig.id, id));

	if (!config) {
		throw new Error('Sync configuration not found');
	}

	return config;
});

/**
 * Query: Get recent sync logs for a configuration
 */
export const getOperations = query(v.string(), async (configId: string): Promise<SyncOperation[]> => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'synchronizations', 'use');

	return await db
		.select()
		.from(syncOperation)
		.where(eq(syncOperation.syncConfigId, configId))
		.orderBy(desc(syncOperation.startedAt))
		.limit(50);
});
