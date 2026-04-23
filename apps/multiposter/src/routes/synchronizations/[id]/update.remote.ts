import { form } from '$app/server';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { db } from '$lib/server/db';
import { syncConfig } from '@ac/db';
import { eq, and } from 'drizzle-orm';
import { updateSynchronizationSchema, type UpdateSynchronizationInput } from '$lib/validations/synchronizations';
export type { UpdateSynchronizationInput };
import { list as listSynchronizations } from '../list.remote';
import { view as viewSynchronization } from './view.remote';

/**
 * Update a sync configuration
 */
export const updateSynchronization = form(updateSynchronizationSchema, async (data) => {
	console.log('--- updateSynchronization START ---');
	console.log('Data received:', JSON.stringify(data, null, 2));

	try {
		const user = getAuthenticatedUser();
		ensureAccess(user, 'synchronizations');
		console.log('User authenticated:', user.id);

		const { id, ...input } = data;

		// Verify ownership
		const [existing] = await db
			.select()
			.from(syncConfig)
			.where(eq(syncConfig.id, id));

		if (!existing) {
			console.error('Sync config not found:', id);
			return { success: false, error: { message: 'Sync configuration not found' } };
		}

		// Update config
		const [updated] = await db
			.update(syncConfig)
			.set({
				name: input.name !== undefined ? input.name : existing.name,
				enabled: input.enabled !== undefined ? (typeof input.enabled === 'string' ? input.enabled === 'true' : !!input.enabled) : existing.enabled,
				direction: input.direction !== undefined ? input.direction : existing.direction,
				settings: input.settings !== undefined ? input.settings : existing.settings,
				updatedAt: new Date()
			})
			.where(eq(syncConfig.id, id))
			.returning();

		if (!updated) {
			throw new Error('Update failed');
		}

		viewSynchronization(id).set(updated);
		void listSynchronizations().refresh();

		console.log('--- updateSynchronization SUCCESS ---');
		return { success: true, synchronization: updated };
	} catch (err: any) {
		console.error('--- updateSynchronization ERROR ---', err);
		return { success: false, error: { message: err.message || 'Update failed' } };
	}
});
