import { command, query, requested } from '$app/server';
import { db, eventFile, announcementFile, file, eq } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import {
	fileAssociationSchema,
	getFileAssociationsSchema,
	syncEntityFolderSchema,
	toggleEntityFolderArchiveSchema,
	resolveShareLinkSchema,
	type FileItem,
	type EntityFolderStatus
} from '@ac/validations';
import {
	addAssociation as dbAddAssociation,
	removeAssociation as dbRemoveAssociation
} from '#lib/server/associations.js';
import { resolveEventIdForAssociations } from '#lib/server/events/exceptions.js';
import { fileStorageService, MicrosoftGraphStorageProvider } from '#lib/server/files/index.js';
import { listFiles } from './list.remote';

const tableMap = {
	event: eventFile,
	announcement: announcementFile
} as const;

const fieldMap = {
	event: 'eventId',
	announcement: 'announcementId'
} as const;

export const addFileAssociation = command(fileAssociationSchema, async (data) => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'files');

	const { type, entityId, fileId, itemId } = data;
	const targetId = fileId || itemId;
	if (!targetId) throw new Error('Missing file ID');

	await dbAddAssociation({
		type,
		entityId,
		itemId: targetId,
		tableMap,
		fieldMap,
		itemField: 'fileId',
		userId: user?.id
	});

	await fetchEntityFiles({ type, entityId }).refresh();
	return { success: true };
});

export const removeFileAssociation = command(fileAssociationSchema, async (data) => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'files');

	const { type, entityId, fileId, itemId } = data;
	const targetId = fileId || itemId;
	if (!targetId) throw new Error('Missing file ID');

	await dbRemoveAssociation({
		type,
		entityId,
		itemId: targetId,
		tableMap,
		fieldMap,
		itemField: 'fileId',
		userId: user?.id
	});

	await fetchEntityFiles({ type, entityId }).refresh();
	return { success: true };
});

export const fetchEntityFiles = query(
	getFileAssociationsSchema,
	async (data): Promise<FileItem[]> => {
		const user = getAuthenticatedUser();
		ensureAccess(user, 'files');

		const { type, entityId } = data;
		if (!entityId) return [];

		let targetEntityId = entityId;
		if (type === 'event' && entityId.includes('_inst_')) {
			targetEntityId = await resolveEventIdForAssociations(entityId, {
				materializeIfVirtual: false
			});
		}

		const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
			targetEntityId
		);
		if (!isUuid) return [];

		// Check if entity folder exists and if we should auto-sync from SharePoint/OneDrive
		try {
			const folderStatus = await fileStorageService.getEntityFolderStatus(type, targetEntityId);
			const lastSyncMs = folderStatus?.lastSyncedAt
				? new Date(folderStatus.lastSyncedAt).getTime()
				: 0;
			// Auto-sync if never synced or last synced > 30 seconds ago
			if (!folderStatus || Date.now() - lastSyncMs > 30_000) {
				const synced = await fileStorageService.ensureAndSyncEntityFolder({
					type,
					entityId: targetEntityId,
					userId: user.id
				});
				return synced.files;
			}
		} catch (err) {
			console.warn('[fetchEntityFiles] Background folder sync skipped:', err);
		}

		return await fileStorageService.fetchDbEntityFiles(type, targetEntityId);
	}
);

export const getEntityFolderInfo = query(
	getFileAssociationsSchema,
	async (data): Promise<EntityFolderStatus | null> => {
		const user = getAuthenticatedUser();
		ensureAccess(user, 'files');

		if (!data.entityId) return null;
		return await fileStorageService.getEntityFolderStatus(data.type, data.entityId);
	}
);

export const syncEntityFolderCommand = command(syncEntityFolderSchema, async (data) => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'files');

	const result = await fileStorageService.ensureAndSyncEntityFolder({
		type: data.type,
		entityId: data.entityId,
		userId: user.id
	});

	try {
		await fetchEntityFiles({ type: data.type, entityId: data.entityId }).refresh();
		await getEntityFolderInfo({ type: data.type, entityId: data.entityId }).refresh();
		await requested(listFiles, 10).refreshAll();
		void listFiles().refresh();
	} catch {
		// Ignore
	}

	return result;
});

export const toggleEntityFolderArchive = command(toggleEntityFolderArchiveSchema, async (data) => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'files');

	const result = await fileStorageService.ensureAndSyncEntityFolder({
		type: data.type,
		entityId: data.entityId,
		userId: user.id,
		manualArchiveOverride: data.isArchived
	});

	try {
		await fetchEntityFiles({ type: data.type, entityId: data.entityId }).refresh();
		await getEntityFolderInfo({ type: data.type, entityId: data.entityId }).refresh();
		await requested(listFiles, 10).refreshAll();
		void listFiles().refresh();
	} catch {
		// Ignore
	}

	return result;
});

export const resolveShareLinkCommand = command(resolveShareLinkSchema, async (data) => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'files');

	const provider = new MicrosoftGraphStorageProvider();
	const active = await fileStorageService.getActiveLibraryConfig();
	if (active) {
		await provider.initialize(active.config as any, user.id);
	} else {
		await provider.initializeDirect({ userId: user.id, authMode: 'auto' });
	}

	const resolved = await provider.resolveShareLink(data.url);

	if (data.fileId && resolved) {
		const [existing] = await db.select().from(file).where(eq(file.id, data.fileId)).limit(1);
		if (existing) {
			await db
				.update(file)
				.set({
					webUrl: resolved.webUrl || existing.webUrl,
					targetDriveId: resolved.driveId ?? existing.targetDriveId,
					targetItemId: resolved.itemId ?? existing.targetItemId,
					targetType: resolved.targetType ?? existing.targetType,
					metadata: {
						...(existing.metadata || {}),
						remoteChildren: resolved.children || []
					},
					lastSyncedAt: new Date(),
					updatedAt: new Date()
				})
				.where(eq(file.id, data.fileId));
		}
	}

	return resolved;
});
