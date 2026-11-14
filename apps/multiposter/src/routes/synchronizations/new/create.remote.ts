import * as v from 'valibot';
import { form } from '$app/server';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { db } from '@ac/db';
import { syncConfig, account, encryptSyncCredentials } from '@ac/db'; // Updated syncConfig import path
import { eq, and } from '@ac/db';
import { syncService } from '#lib/server/sync/service.js';
import { MicrosoftGraphClient } from '#lib/server/sync/providers/microsoft/index.js';
import { createSynchronizationSchema, normalizeSyncSettings } from '#lib/validations/synchronizations.js';
import { list as listSynchronizations } from '../list.remote'; // New import



export const create = form(createSynchronizationSchema, async (input) => {
	console.log('--- createSynchronization START - VERSION 2 ---');
	console.log('Input raw:', input);
	console.log('Data received JSON:', JSON.stringify(input, null, 2));

	try {
		const user = getAuthenticatedUser();
		ensureAccess(user, 'synchronizations');
		console.log('User authenticated:', user.id);

		// Find the user's OAuth account for the selected provider (if OAuth-based)
		const providerIdMap: Record<string, string> = {
			'google-calendar': 'google',
			'microsoft-calendar': 'microsoft'
		};

		const oauthProviderId = providerIdMap[input.providerType];
		let credentials: any = null;

		const settings = typeof input.settings === 'string' ? JSON.parse(input.settings) : (input.settings || {});
		normalizeSyncSettings(settings);

		const isMicrosoftAppOnly =
			input.providerType === 'microsoft-calendar' &&
			(settings?.authMode === 'app' || (settings?.authMode !== 'user' && settings?.mailboxType === 'shared' && settings?.mailboxEmail));

		if (oauthProviderId) {
			// OAuth-based provider - verify account exists (optional if Microsoft app-only mode is used)
			const [userAccount] = await db
				.select()
				.from(account)
				.where(and(eq(account.userId, user.id), eq(account.providerId, oauthProviderId)))
				.limit(1);

			if (!userAccount && !isMicrosoftAppOnly) {
				throw new Error(
					`No ${oauthProviderId} account connected. Please connect your account in settings first.`
				);
			}

			if (userAccount) {
				credentials = {
					accessToken: userAccount.accessToken,
					refreshToken: userAccount.refreshToken,
					expiresAt: userAccount.accessTokenExpiresAt?.getTime()
				};
			}
		} else if (input.credentials) {
			// Direct credentials (username/password)
			credentials = typeof input.credentials === 'string' ? JSON.parse(input.credentials) : input.credentials;
			console.log('Using direct credentials from input');
		}

		const syncConfigId = crypto.randomUUID();
		const encryptedCredentials = await encryptSyncCredentials(syncConfigId, credentials);

		const insertData: any = {
			id: syncConfigId,
			userId: user.id,
			name: input.name || input.providerId || 'Sync',
			providerId: input.providerId || input.name,
			providerType: input.providerType,
			direction: input.direction,
			enabled: true,
			credentials: encryptedCredentials,
			settings,
			createdAt: new Date(),
			updatedAt: new Date()
		};

		console.log('Final insertData:', JSON.stringify(insertData, null, 2));
		
		const [config] = await db
			.insert(syncConfig)
			.values(insertData)
			.returning();

		if (!config) {
			throw new Error('Failed to create synchronization configuration');
		}

		const newConfigId = config.id;

		if (
			input.providerType === 'microsoft-calendar' &&
			(settings?.calendarVisibility === 'read' ||
				settings?.calendarVisibility === 'limitedRead' ||
				settings?.calendarVisibility === 'freeBusyRead')
		) {
			try {
				const msClient = new MicrosoftGraphClient();
				await msClient.initialize({
					id: config.id,
					userId: config.userId,
					providerId: config.providerId ?? 'microsoft',
					providerType: config.providerType as any,
					direction: config.direction as any,
					enabled: config.enabled,
					credentials: (credentials ?? config.credentials) as any,
					settings: config.settings as any,
					createdAt: config.createdAt,
					updatedAt: config.updatedAt
				});
				await msClient.ensureOrganizationCalendarPermission(
					settings.calendarVisibility,
					settings.mailboxEmail,
					settings.calendarId
				);
			} catch (permErr) {
				console.warn('[CreateSync] Could not apply Microsoft calendar organization visibility:', permErr);
			}
		}

		// Setup webhook for push notifications if direction is pull or bidirectional
		if (input.direction === 'pull' || input.direction === 'bidirectional') {
			try {
				await syncService.setupWebhook(newConfigId);
			} catch (error: any) {
				console.error(`[CreateSync] Failed to setup webhook:`, error);
				// Don't fail the sync creation if webhook setup fails
				// User can still manually sync or retry webhook setup later
			}
		}

		await listSynchronizations().refresh();

		console.log('--- createSynchronization SUCCESS ---');
		return { success: true, synchronization: config };
	} catch (err: any) {
		console.error('--- createSynchronization ERROR ---');
		console.error('Error message:', err.message);
		console.error('Error stack:', err.stack);
		console.error('Error full:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
		return { success: false, error: { message: err.message || 'Creation failed' } };
	}
});
