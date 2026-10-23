import { query, form, command } from '$app/server';
import { db, syncConfig, eq, and, desc } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { saveLibraryRootConfigSchema, type LibraryRootSettings } from '@ac/validations';
import { fileStorageService, MicrosoftGraphStorageProvider } from '#lib/server/files/index.js';
import * as v from 'valibot';

export const getLibraryRootConfig = query(async () => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'files');

	const active = await fileStorageService.getActiveLibraryConfig();
	if (!active) {
		return null;
	}

	return {
		id: active.config.id,
		name: active.config.name,
		enabled: active.config.enabled,
		status: active.config.status,
		lastSyncAt: active.config.lastSyncAt ? active.config.lastSyncAt.toISOString() : null,
		settings: active.settings
	};
});

export const saveLibraryRootConfig = form(saveLibraryRootConfigSchema, async (data) => {
	try {
		const user = getAuthenticatedUser();
		ensureAccess(user, 'files');

		const settings: LibraryRootSettings = {
			targetType: data.targetType,
			authMode: data.authMode || 'auto',
			teamId: data.teamId || undefined,
			teamName: data.teamName || undefined,
			channelId: data.channelId || undefined,
			channelName: data.channelName || undefined,
			siteId: data.siteId || undefined,
			siteName: data.siteName || undefined,
			driveId: data.driveId,
			driveName: data.driveName || undefined,
			rootFolderId: data.rootFolderId || undefined,
			rootFolderPath: data.rootFolderPath || undefined,
			webUrl: data.webUrl || undefined,
			userEmail: data.userEmail || undefined,
			eventsFolderName: data.eventsFolderName?.trim() || 'Events',
			announcementsFolderName: data.announcementsFolderName?.trim() || 'Announcements',
			archiveFolderName: data.archiveFolderName?.trim() || 'Archive',
			autoArchivePastEvents:
				data.autoArchivePastEvents !== undefined ? Boolean(data.autoArchivePastEvents) : true,
			isDefault: true
		};

		// Provision base folders (Events, Events/Archive, Announcements, Announcements/Archive) if connection works
		let status = 'active';
		try {
			const provider = new MicrosoftGraphStorageProvider();
			await provider.initializeDirect({
				userId: user.id,
				authMode: settings.authMode,
				mailboxEmail: settings.userEmail
			});

			const eventsRef = await provider.ensureFolderPath(
				settings.driveId,
				settings.rootFolderId,
				[settings.eventsFolderName]
			);
			await provider.ensureFolderPath(settings.driveId, settings.rootFolderId, [
				settings.eventsFolderName,
				settings.archiveFolderName
			]);
			await provider.ensureFolderPath(settings.driveId, settings.rootFolderId, [
				settings.announcementsFolderName
			]);
			await provider.ensureFolderPath(settings.driveId, settings.rootFolderId, [
				settings.announcementsFolderName,
				settings.archiveFolderName
			]);

			if (!settings.webUrl && eventsRef.webUrl) {
				settings.webUrl = eventsRef.webUrl.replace(/\/[^/]+$/, '');
			}
		} catch (provisionErr) {
			console.warn('[saveLibraryRootConfig] Base folder provisioning warning:', provisionErr);
		}

		let savedId = data.id;
		if (savedId) {
			await db
				.update(syncConfig)
				.set({
					name: data.name,
					settings: settings as any,
					status,
					enabled: true,
					lastSyncAt: new Date(),
					updatedAt: new Date()
				})
				.where(eq(syncConfig.id, savedId));
		} else {
			const [existing] = await db
				.select()
				.from(syncConfig)
				.where(eq(syncConfig.providerType, 'microsoft-files'))
				.orderBy(desc(syncConfig.updatedAt))
				.limit(1);

			if (existing) {
				savedId = existing.id;
				await db
					.update(syncConfig)
					.set({
						name: data.name,
						settings: settings as any,
						status,
						enabled: true,
						lastSyncAt: new Date(),
						updatedAt: new Date()
					})
					.where(eq(syncConfig.id, existing.id));
			} else {
				const [inserted] = await db
					.insert(syncConfig)
					.values({
						userId: user.id,
						name: data.name,
						providerId: 'microsoft-files',
						providerType: 'microsoft-files',
						direction: 'bidirectional',
						enabled: true,
						settings: settings as any,
						status,
						lastSyncAt: new Date()
					})
					.returning();
				savedId = inserted.id;
			}
		}

		await getLibraryRootConfig().refresh();

		return {
			success: true,
			id: savedId,
			settings
		};
	} catch (err: any) {
		return {
			success: false,
			error: {
				message: err?.message || 'Failed to save Library Root configuration'
			}
		};
	}
});

export const listStorageTeams = query(
	v.optional(
		v.object({
			search: v.optional(v.string()),
			authMode: v.optional(v.picklist(['auto', 'app', 'user']))
		}),
		{}
	),
	async (input) => {
		const user = getAuthenticatedUser();
		ensureAccess(user, 'files');

		const provider = new MicrosoftGraphStorageProvider();
		await provider.initializeDirect({
			userId: user.id,
			authMode: input?.authMode || 'auto'
		});

		return await provider.listTeams(input?.search);
	}
);

export const listStorageTeamChannels = query(
	v.object({
		teamId: v.string(),
		authMode: v.optional(v.picklist(['auto', 'app', 'user']))
	}),
	async (input) => {
		const user = getAuthenticatedUser();
		ensureAccess(user, 'files');

		if (!input.teamId) return [];

		const provider = new MicrosoftGraphStorageProvider();
		await provider.initializeDirect({
			userId: user.id,
			authMode: input.authMode || 'auto'
		});

		return await provider.listTeamChannels(input.teamId);
	}
);

export const resolveStorageTeamChannelFolder = command(
	v.object({
		teamId: v.string(),
		channelId: v.string(),
		authMode: v.optional(v.picklist(['auto', 'app', 'user']))
	}),
	async (input) => {
		const user = getAuthenticatedUser();
		ensureAccess(user, 'files');

		const provider = new MicrosoftGraphStorageProvider();
		await provider.initializeDirect({
			userId: user.id,
			authMode: input.authMode || 'auto'
		});

		return await provider.resolveChannelDriveFolder(input.teamId, input.channelId);
	}
);

export const listStorageSharePointSites = query(
	v.optional(
		v.object({
			search: v.optional(v.string()),
			authMode: v.optional(v.picklist(['auto', 'app', 'user']))
		}),
		{}
	),
	async (input) => {
		const user = getAuthenticatedUser();
		ensureAccess(user, 'files');

		const provider = new MicrosoftGraphStorageProvider();
		await provider.initializeDirect({
			userId: user.id,
			authMode: input?.authMode || 'auto'
		});

		return await provider.listSharePointSites(input?.search);
	}
);

export const listStorageSiteDrives = query(
	v.object({
		siteId: v.string(),
		authMode: v.optional(v.picklist(['auto', 'app', 'user']))
	}),
	async (input) => {
		const user = getAuthenticatedUser();
		ensureAccess(user, 'files');

		if (!input.siteId) return [];

		const provider = new MicrosoftGraphStorageProvider();
		await provider.initializeDirect({
			userId: user.id,
			authMode: input.authMode || 'auto'
		});

		return await provider.listSiteDrives(input.siteId);
	}
);

export const resolveStorageUserDrive = command(
	v.object({
		userEmail: v.optional(v.string()),
		authMode: v.optional(v.picklist(['auto', 'app', 'user']))
	}),
	async (input) => {
		const user = getAuthenticatedUser();
		ensureAccess(user, 'files');

		const provider = new MicrosoftGraphStorageProvider();
		await provider.initializeDirect({
			userId: user.id,
			authMode: input.authMode || 'auto',
			mailboxEmail: input.userEmail
		});

		return await provider.getUserDrive(input.userEmail);
	}
);
