import { command } from '$app/server';
import * as v from 'valibot';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { syncService } from '$lib/server/sync/service';
import { processBulkSyncBatchSchema } from '$lib/validations/synchronizations';
import { readSynchronization as viewSyncConfig } from './read.remote';

/**
 * Start a bulk sync process for a configuration.
 * Pulls from provider (if applicable) and prepares chunked sync queue.
 */
export const startBulkSync = command(v.pipe(v.string(), v.uuid()), async (configId: string) => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'synchronizations');

	const result = await syncService.startBulkSync(configId);
	if (result.done) {
		await viewSyncConfig(configId).refresh();
	}

	return result;
});

/**
 * Process a batch of items in a bulk sync operation.
 * Runs within safe serverless execution limits.
 */
export const processBulkSyncBatch = command(processBulkSyncBatchSchema, async (input) => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'synchronizations');

	const result = await syncService.processBulkSyncBatch(input.configId, input.operationId, input.batchSize ?? 10);
	if (result.done) {
		await viewSyncConfig(input.configId).refresh();
	}

	return result;
});

/**
 * Trigger a synchronization for a config (backwards-compatible execution)
 */
export const sync = command(v.string(), async (configId: string) => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'synchronizations');

	const result = await syncService.syncEvents(configId);
	await viewSyncConfig(configId).refresh();

	return { success: result.success };
});
