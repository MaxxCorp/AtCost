import { form, requested } from '$app/server';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { db } from '@ac/db';
import { syncConfig, decryptSyncCredentials, encryptSyncCredentials } from '@ac/db';
import { eq, and } from '@ac/db';
import { updateSynchronizationSchema, normalizeSyncSettings } from '#lib/validations/synchronizations.js';
import { MicrosoftGraphClient } from '#lib/server/sync/providers/microsoft/index.js';
import { list as listSynchronizations } from '../list.remote';
import { readSynchronization as read } from './read.remote';

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
		const newSettings = input.settings !== undefined
			? (typeof input.settings === 'string' ? JSON.parse(input.settings) : { ...(existing.settings as any || {}), ...input.settings })
			: existing.settings;

		if (newSettings) {
			normalizeSyncSettings(newSettings);
		}

		const decryptedExistingCredentials = await decryptSyncCredentials(existing.credentials);
		const plainCredentials = input.credentials !== undefined
			? (typeof input.credentials === 'string' ? JSON.parse(input.credentials) : { ...(decryptedExistingCredentials || {}), ...input.credentials })
			: decryptedExistingCredentials;
		const encryptedCredentials = await encryptSyncCredentials(id, plainCredentials);

		const [updated] = await db
			.update(syncConfig)
			.set({
				name: input.name !== undefined ? input.name : existing.name,
				providerId: input.providerId !== undefined ? input.providerId : (input.name !== undefined ? input.name : existing.providerId),
				enabled: typeof input.enabled === 'string' ? input.enabled === 'true' : (input.enabled !== undefined ? !!input.enabled : existing.enabled),
				direction: input.direction !== undefined ? input.direction : existing.direction,
				credentials: encryptedCredentials,
				settings: newSettings,
				updatedAt: new Date()
			})
			.where(eq(syncConfig.id, id))
			.returning();

		if (!updated) {
			throw new Error('Update failed');
		}

		if (
			updated.providerType === 'microsoft-calendar' &&
			(newSettings?.calendarVisibility === 'read' ||
				newSettings?.calendarVisibility === 'limitedRead' ||
				newSettings?.calendarVisibility === 'freeBusyRead')
		) {
			try {
				const msClient = new MicrosoftGraphClient();
				await msClient.initialize({
					id: updated.id,
					userId: updated.userId,
					providerId: updated.providerId ?? 'microsoft',
					providerType: updated.providerType as any,
					direction: updated.direction as any,
					enabled: updated.enabled,
					credentials: plainCredentials as any,
					settings: updated.settings as any,
					createdAt: updated.createdAt,
					updatedAt: updated.updatedAt
				});
				await msClient.ensureOrganizationCalendarPermission(
					newSettings.calendarVisibility,
					newSettings.mailboxEmail,
					newSettings.calendarId
				);
			} catch (permErr) {
				console.warn('[UpdateSync] Could not apply Microsoft calendar organization visibility:', permErr);
			}
		}

		read(id).set(updated);
		await requested(listSynchronizations, 50).refreshAll();
		await listSynchronizations().refresh();

		console.log('--- updateSynchronization SUCCESS ---');
		return { success: true, synchronization: updated };
	} catch (err: any) {
		console.error('--- updateSynchronization ERROR ---', err);
		return { success: false, error: { message: err.message || 'Update failed' } };
	}
});
