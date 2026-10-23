import { form, requested } from '$app/server';
import { db, file, eventFile, announcementFile, eq } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { createFileSchema } from '@ac/validations';
import { fileStorageService, type ExternalStorageItem } from '#lib/server/files/index.js';
import { resolveEventIdForAssociations } from '#lib/server/events/exceptions.js';
import { listFiles } from '../list.remote';
import { fetchEntityFiles, getEntityFolderInfo } from '../associate.remote';

export const createFile = form(createFileSchema, async (data) => {
	try {
		const user = getAuthenticatedUser();
		ensureAccess(user, 'files');

		const creationMode = data.creationMode || 'office_doc';
		const docType = data.officeDocType || 'docx';

		let resolvedEntityId = data.entityId;
		if (data.entityType === 'event' && resolvedEntityId && resolvedEntityId.includes('_inst_')) {
			resolvedEntityId = await resolveEventIdForAssociations(resolvedEntityId, {
				materializeIfVirtual: true,
				userId: user.id
			});
		}

		// Check if we have an active Microsoft Graph Library Root
		const ctx = await fileStorageService.getInitializedProvider(user.id);

		let extItem: ExternalStorageItem | null = null;
		let folderPath = 'Library Root';
		let isArchived = false;

		if (ctx) {
			const { provider, config, settings } = ctx;
			let targetDriveId = settings.driveId;
			let targetFolderId = settings.rootFolderId || 'root';

			// If creating inside a specific Event or Announcement, ensure its deterministic folder first
			if (data.entityType && resolvedEntityId) {
				const synced = await fileStorageService.ensureAndSyncEntityFolder({
					type: data.entityType,
					entityId: resolvedEntityId,
					userId: user.id
				});
				if (synced.folder) {
					targetDriveId = synced.folder.driveId;
					targetFolderId = synced.folder.folderItemId;
					folderPath = synced.folder.folderPath;
					isArchived = synced.folder.isArchived;
				}
			}

			try {
				if (creationMode === 'office_doc') {
					extItem = await provider.createOfficeFile(
						targetDriveId,
						targetFolderId,
						data.name,
						docType
					);
				} else if (creationMode === 'upload' && data.fileContentBase64) {
					const cleanBase64 = data.fileContentBase64.replace(/^data:[^;]+;base64,/, '');
					const bytes = Uint8Array.from(Buffer.from(cleanBase64, 'base64'));
					extItem = await provider.uploadFile(
						targetDriveId,
						targetFolderId,
						data.name,
						bytes,
						data.fileMimeType || 'application/octet-stream'
					);
				} else if (creationMode === 'link' && data.targetUrl) {
					if (data.createShortcutInFolder !== false) {
						extItem = await provider.createShortcutFile(
							targetDriveId,
							targetFolderId,
							data.name,
							data.targetUrl
						);
					} else {
						const resolved = await provider.resolveShareLink(data.targetUrl);
						extItem = {
							externalItemId: resolved?.itemId || `link-${crypto.randomUUID()}`,
							driveId: resolved?.driveId || targetDriveId,
							parentItemId: targetFolderId,
							name: data.name || resolved?.name || 'Shared Link',
							itemType: 'link',
							mimeType: resolved?.mimeType || 'text/uri-list',
							extension: 'url',
							size: resolved?.size ?? 0,
							webUrl: resolved?.webUrl || data.targetUrl,
							isShortcut: true,
							targetUrl: data.targetUrl,
							targetDriveId: resolved?.driveId,
							targetItemId: resolved?.itemId,
							targetType: resolved?.targetType || 'external_url',
							remoteChildren: resolved?.children
						};
					}
				}

				if (extItem) {
					const dbRecord = await fileStorageService.upsertExternalItemIntoDb({
						extItem,
						syncConfigId: config.id,
						userId: user.id,
						folderPath,
						isArchived,
						entityType: data.entityType,
						entityId: resolvedEntityId
					});

					if (data.description) {
						await db
							.update(file)
							.set({ description: data.description })
							.where(eq(file.id, dbRecord.id));
						dbRecord.description = data.description;
					}

					const serialized = fileStorageService.serializeFile(dbRecord);

					try {
						await requested(listFiles, 20).refreshAll();
						void listFiles().refresh();
						if (data.entityType && data.entityId) {
							await fetchEntityFiles({
								type: data.entityType,
								entityId: data.entityId
							}).refresh();
							await getEntityFolderInfo({
								type: data.entityType,
								entityId: data.entityId
							}).refresh();
						}
					} catch {
						// Ignore
					}

					return {
						success: true,
						data: serialized
					};
				}
			} catch (cloudErr: any) {
				console.warn(
					'[createFile] Cloud operation warning, falling back to local DB record:',
					cloudErr?.message
				);
			}
		}

		// Fallback when no Library Root is active or cloud API is offline: store in Postgres
		const ext =
			creationMode === 'office_doc'
				? docType
				: creationMode === 'link'
					? 'url'
					: data.name.includes('.')
						? data.name.split('.').pop()?.toLowerCase() || ''
						: '';

		const finalName =
			creationMode === 'office_doc' && !data.name.toLowerCase().endsWith(`.${docType}`)
				? `${data.name}.${docType}`
				: data.name;

		const [inserted] = await db
			.insert(file)
			.values({
				userId: user.id,
				syncConfigId: ctx?.config.id ?? null,
				name: finalName,
				description: data.description || null,
				itemType:
					creationMode === 'link'
						? 'link'
						: creationMode === 'office_doc'
							? 'office_doc'
							: 'file',
				mimeType:
					data.fileMimeType ||
					(creationMode === 'link' ? 'text/uri-list' : 'application/octet-stream'),
				extension: ext,
				size: typeof data.fileSize === 'number' ? data.fileSize : 0,
				webUrl: data.targetUrl || null,
				folderPath,
				isShortcut: creationMode === 'link',
				targetUrl: data.targetUrl || null,
				targetType: creationMode === 'link' ? 'external_url' : null,
				isArchived
			})
			.returning();

		if (data.entityType === 'event' && resolvedEntityId) {
			await db
				.insert(eventFile)
				.values({ eventId: resolvedEntityId, fileId: inserted.id })
				.onConflictDoNothing();
		} else if (data.entityType === 'announcement' && resolvedEntityId) {
			await db
				.insert(announcementFile)
				.values({ announcementId: resolvedEntityId, fileId: inserted.id })
				.onConflictDoNothing();
		}

		const serialized = fileStorageService.serializeFile(inserted);

		try {
			await requested(listFiles, 20).refreshAll();
			void listFiles().refresh();
			if (data.entityType && data.entityId) {
				await fetchEntityFiles({
					type: data.entityType,
					entityId: data.entityId
				}).refresh();
			}
		} catch {
			// Ignore
		}

		return {
			success: true,
			data: serialized
		};
	} catch (err: any) {
		console.error('--- createFile ERROR ---', err);
		return {
			success: false,
			error: {
				message: err?.message || 'Failed to create file'
			}
		};
	}
});
