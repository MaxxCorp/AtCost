import {
	db,
	file,
	eventFile,
	announcementFile,
	entityFileFolder,
	event,
	announcement,
	syncConfig,
	syncMapping,
	eq,
	and,
	desc
} from '@ac/db';
import type { LibraryRootSettings, FileItem, EntityFolderStatus } from '@ac/validations';
import { resolveEventIdForAssociations } from '../events/exceptions.js';
import { MicrosoftGraphStorageProvider } from './microsoft-provider.js';
import type { ExternalStorageItem, FileStorageProvider, StorageFolderRef } from './types.js';

function sanitizeFolderSegment(input: string): string {
	return input
		.replace(/["*:<>?/\\|#%]/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/\.+$/g, '')
		.slice(0, 80)
		.trim();
}

function formatIsoDatePrefix(dateInput?: Date | string | null): string {
	if (!dateInput) {
		return new Date().toISOString().slice(0, 10);
	}
	const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
	if (isNaN(d.getTime())) {
		return new Date().toISOString().slice(0, 10);
	}
	return d.toISOString().slice(0, 10);
}

export function buildDeterministicEntityFolderName(params: {
	date?: Date | string | null;
	title: string;
	uuid: string;
}): string {
	const datePrefix = formatIsoDatePrefix(params.date);
	const cleanTitle = sanitizeFolderSegment(params.title || 'Untitled') || 'Untitled';
	return `${datePrefix} ${cleanTitle} ${params.uuid}`;
}

export class FileStorageService {
	private getProviderForType(providerType = 'microsoft-files'): FileStorageProvider {
		if (providerType === 'microsoft-files') {
			return new MicrosoftGraphStorageProvider();
		}
		return new MicrosoftGraphStorageProvider();
	}

	async getActiveLibraryConfig(): Promise<{
		config: typeof syncConfig.$inferSelect;
		settings: LibraryRootSettings;
	} | null> {
		const configs = await db
			.select()
			.from(syncConfig)
			.where(and(eq(syncConfig.providerType, 'microsoft-files'), eq(syncConfig.enabled, true)))
			.orderBy(desc(syncConfig.updatedAt))
			.limit(1);

		const active = configs[0];
		if (!active) return null;

		const raw = (active.settings || {}) as Partial<LibraryRootSettings>;
		if (!raw.driveId) return null;

		const settings: LibraryRootSettings = {
			targetType: raw.targetType || 'teams_channel',
			authMode: raw.authMode || 'auto',
			teamId: raw.teamId,
			teamName: raw.teamName,
			channelId: raw.channelId,
			channelName: raw.channelName,
			siteId: raw.siteId,
			siteName: raw.siteName,
			driveId: raw.driveId,
			driveName: raw.driveName,
			rootFolderId: raw.rootFolderId,
			rootFolderPath: raw.rootFolderPath,
			webUrl: raw.webUrl,
			userEmail: raw.userEmail,
			eventsFolderName: raw.eventsFolderName || 'Events',
			announcementsFolderName: raw.announcementsFolderName || 'Announcements',
			archiveFolderName: raw.archiveFolderName || 'Archive',
			autoArchivePastEvents: raw.autoArchivePastEvents ?? true,
			isDefault: raw.isDefault ?? true
		};

		return { config: active, settings };
	}

	async getInitializedProvider(userId?: string): Promise<{
		provider: FileStorageProvider;
		config: typeof syncConfig.$inferSelect;
		settings: LibraryRootSettings;
	} | null> {
		const active = await this.getActiveLibraryConfig();
		if (!active) return null;

		const provider = this.getProviderForType(active.config.providerType);
		await provider.initialize(active.config as any, userId);

		return {
			provider,
			config: active.config,
			settings: active.settings
		};
	}

	/**
	 * Determines whether an event or announcement should be placed in the Archive subfolder
	 */
	shouldAutoArchiveEntity(
		entityType: 'event' | 'announcement',
		entityRow: any,
		settings: LibraryRootSettings
	): boolean {
		if (entityType === 'announcement') {
			return entityRow.status === 'archived';
		}

		if (entityRow.status === 'cancelled') {
			return true;
		}

		if (!settings.autoArchivePastEvents) {
			return false;
		}

		// For recurring master events, check if the RRULE has an UNTIL in the past; otherwise keep active
		const recurrence = entityRow.recurrence as string[] | null;
		if (recurrence && Array.isArray(recurrence) && recurrence.length > 0 && !entityRow.isException) {
			const rruleStr = recurrence[0] || '';
			const untilMatch = rruleStr.match(/UNTIL=([0-9T]+Z?)/i);
			if (!untilMatch) {
				// Ongoing series without UNTIL date -> do not auto-archive master folder
				return false;
			}
		}

		if (entityRow.endDateTime) {
			const end = new Date(entityRow.endDateTime);
			if (!isNaN(end.getTime()) && end.getTime() < Date.now()) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Ensures the Library Root base structure (e.g. Events/, Events/Archive/, Announcements/, Announcements/Archive/)
	 * and the specific entity folder (<startdate> <name> <uuid>) exist, moves to/from Archive if needed,
	 * and scans the folder so any manually placed files or links are synced into Postgres.
	 */
	async ensureAndSyncEntityFolder(params: {
		type: 'event' | 'announcement';
		entityId: string;
		userId?: string;
		manualArchiveOverride?: boolean;
	}): Promise<{
		folder: EntityFolderStatus | null;
		files: FileItem[];
	}> {
		const { type, userId, manualArchiveOverride } = params;
		let targetEntityId = params.entityId;

		if (type === 'event' && targetEntityId.includes('_inst_')) {
			targetEntityId = await resolveEventIdForAssociations(targetEntityId, {
				materializeIfVirtual: false,
				userId
			});
		}

		const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
			targetEntityId
		);
		if (!isUuid) {
			return { folder: null, files: [] };
		}

		// Fetch entity metadata
		const entityRow =
			type === 'event'
				? await db.query.event.findFirst({ where: eq(event.id, targetEntityId) })
				: await db.query.announcement.findFirst({ where: eq(announcement.id, targetEntityId) });

		if (!entityRow) {
			return { folder: null, files: [] };
		}

		const ctx = await this.getInitializedProvider(userId || entityRow.userId);
		if (!ctx) {
			// No cloud Library Root configured — just return DB-linked files
			const dbFiles = await this.fetchDbEntityFiles(type, targetEntityId);
			return { folder: null, files: dbFiles };
		}

		const { provider, config, settings } = ctx;
		const categoryFolder =
			type === 'event'
				? settings.eventsFolderName || 'Events'
				: settings.announcementsFolderName || 'Announcements';
		const archiveFolder = settings.archiveFolderName || 'Archive';

		const entityTitle =
			type === 'event' ? (entityRow as any).summary : (entityRow as any).title;
		const entityDate =
			type === 'event'
				? (entityRow as any).startDateTime || entityRow.createdAt
				: entityRow.createdAt;

		const expectedFolderName = buildDeterministicEntityFolderName({
			date: entityDate,
			title: entityTitle,
			uuid: targetEntityId
		});

		// Look up existing entityFileFolder row
		const [existingFolderRecord] = await db
			.select()
			.from(entityFileFolder)
			.where(
				and(
					eq(entityFileFolder.entityType, type),
					eq(entityFileFolder.entityId, targetEntityId)
				)
			)
			.limit(1);

		const shouldArchive =
			manualArchiveOverride !== undefined
				? manualArchiveOverride
				: existingFolderRecord?.isArchived ||
					this.shouldAutoArchiveEntity(type, entityRow, settings);

		let resolvedFolderRef: StorageFolderRef | null = null;

		try {
			// 1. Always ensure both `<Category>` and `<Category>/<Archive>` exist under Library Root
			const categoryRef = await provider.ensureFolderPath(
				settings.driveId,
				settings.rootFolderId,
				[categoryFolder]
			);
			const archiveRef = await provider.ensureFolderPath(
				settings.driveId,
				settings.rootFolderId,
				[categoryFolder, archiveFolder]
			);

			const desiredParentId = shouldArchive ? archiveRef.itemId : categoryRef.itemId;
			const desiredPath = shouldArchive
				? `${categoryFolder}/${archiveFolder}/${expectedFolderName}`
				: `${categoryFolder}/${expectedFolderName}`;

			if (
				existingFolderRecord &&
				existingFolderRecord.driveId === settings.driveId &&
				existingFolderRecord.folderItemId
			) {
				// Check if folder needs to be moved (Archive <-> Active) or renamed
				if (
					existingFolderRecord.isArchived !== shouldArchive ||
					existingFolderRecord.folderName !== expectedFolderName
				) {
					try {
						const moved = await provider.moveOrRenameFolder(
							settings.driveId,
							existingFolderRecord.folderItemId,
							desiredParentId,
							expectedFolderName
						);
						resolvedFolderRef = {
							...moved,
							path: desiredPath
						};
					} catch {
						// If item was moved/deleted externally, re-ensure it
						resolvedFolderRef = await provider.ensureFolderPath(
							settings.driveId,
							desiredParentId,
							[expectedFolderName]
						);
						resolvedFolderRef.path = desiredPath;
					}
				} else {
					resolvedFolderRef = {
						driveId: existingFolderRecord.driveId,
						itemId: existingFolderRecord.folderItemId,
						name: existingFolderRecord.folderName,
						path: existingFolderRecord.folderPath,
						webUrl: existingFolderRecord.webUrl ?? undefined
					};
				}
			} else {
				// Provision the entity folder under desiredParentId
				const createdRef = await provider.ensureFolderPath(
					settings.driveId,
					desiredParentId,
					[expectedFolderName]
				);
				resolvedFolderRef = {
					...createdRef,
					path: desiredPath
				};
			}

			// Upsert entityFileFolder record
			let savedFolder: typeof entityFileFolder.$inferSelect;
			if (existingFolderRecord) {
				const [updated] = await db
					.update(entityFileFolder)
					.set({
						syncConfigId: config.id,
						driveId: resolvedFolderRef.driveId,
						folderItemId: resolvedFolderRef.itemId,
						folderName: expectedFolderName,
						folderPath: resolvedFolderRef.path,
						webUrl: resolvedFolderRef.webUrl ?? existingFolderRecord.webUrl,
						isArchived: shouldArchive,
						lastSyncedAt: new Date(),
						updatedAt: new Date()
					})
					.where(eq(entityFileFolder.id, existingFolderRecord.id))
					.returning();
				savedFolder = updated;
			} else {
				const [inserted] = await db
					.insert(entityFileFolder)
					.values({
						entityType: type,
						entityId: targetEntityId,
						syncConfigId: config.id,
						driveId: resolvedFolderRef.driveId,
						folderItemId: resolvedFolderRef.itemId,
						folderName: expectedFolderName,
						folderPath: resolvedFolderRef.path,
						webUrl: resolvedFolderRef.webUrl ?? null,
						isArchived: shouldArchive,
						lastSyncedAt: new Date()
					})
					.returning();
				savedFolder = inserted;
			}

			// 2. Scan the folder children so manually placed files and links appear in the DB & EntityManager
			const externalItems = await provider.listFolderChildren(
				resolvedFolderRef.driveId,
				resolvedFolderRef.itemId
			);

			for (const extItem of externalItems) {
				await this.upsertExternalItemIntoDb({
					extItem,
					syncConfigId: config.id,
					userId: userId || entityRow.userId,
					folderPath: resolvedFolderRef.path,
					isArchived: shouldArchive,
					entityType: type,
					entityId: targetEntityId
				});
			}

			const filesList = await this.fetchDbEntityFiles(type, targetEntityId);
			return {
				folder: {
					...savedFolder,
					createdAt: savedFolder.createdAt.toISOString(),
					updatedAt: savedFolder.updatedAt.toISOString(),
					lastSyncedAt: savedFolder.lastSyncedAt ? savedFolder.lastSyncedAt.toISOString() : null
				},
				files: filesList
			};
		} catch (err) {
			console.warn('[FileStorageService] Cloud folder sync warning, falling back to DB files:', err);
			const dbFiles = await this.fetchDbEntityFiles(type, targetEntityId);
			const fallbackFolder = existingFolderRecord
				? {
						...existingFolderRecord,
						createdAt: existingFolderRecord.createdAt.toISOString(),
						updatedAt: existingFolderRecord.updatedAt.toISOString(),
						lastSyncedAt: existingFolderRecord.lastSyncedAt
							? existingFolderRecord.lastSyncedAt.toISOString()
							: null
					}
				: null;
			return { folder: fallbackFolder, files: dbFiles };
		}
	}

	async upsertExternalItemIntoDb(params: {
		extItem: ExternalStorageItem;
		syncConfigId: string;
		userId: string;
		folderPath: string;
		isArchived: boolean;
		entityType?: 'event' | 'announcement';
		entityId?: string;
	}): Promise<typeof file.$inferSelect> {
		const { extItem, syncConfigId, userId, folderPath, isArchived, entityType, entityId } = params;

		const [existing] = await db
			.select()
			.from(file)
			.where(
				and(
					eq(file.driveId, extItem.driveId),
					eq(file.externalItemId, extItem.externalItemId)
				)
			)
			.limit(1);

		const metadata: Record<string, any> = {
			...(existing?.metadata || {}),
			lastModifiedDateTime: extItem.lastModifiedDateTime,
			createdBy: extItem.createdBy,
			remoteChildren: extItem.remoteChildren || []
		};

		let fileRecord: typeof file.$inferSelect;

		if (existing) {
			const [updated] = await db
				.update(file)
				.set({
					syncConfigId,
					name: extItem.name,
					itemType: extItem.itemType,
					mimeType: extItem.mimeType ?? existing.mimeType,
					extension: extItem.extension ?? existing.extension,
					size: extItem.size ?? existing.size,
					webUrl: extItem.webUrl ?? existing.webUrl,
					downloadUrl: extItem.downloadUrl ?? existing.downloadUrl,
					parentItemId: extItem.parentItemId ?? existing.parentItemId,
					folderPath,
					isShortcut: extItem.isShortcut,
					targetUrl: extItem.targetUrl ?? existing.targetUrl,
					targetDriveId: extItem.targetDriveId ?? existing.targetDriveId,
					targetItemId: extItem.targetItemId ?? existing.targetItemId,
					targetType: extItem.targetType ?? existing.targetType,
					isArchived,
					etag: extItem.etag ?? existing.etag,
					metadata,
					lastSyncedAt: new Date(),
					updatedAt: new Date()
				})
				.where(eq(file.id, existing.id))
				.returning();
			fileRecord = updated;
		} else {
			const [inserted] = await db
				.insert(file)
				.values({
					userId,
					syncConfigId,
					name: extItem.name,
					itemType: extItem.itemType,
					mimeType: extItem.mimeType ?? null,
					extension: extItem.extension ?? null,
					size: extItem.size ?? 0,
					webUrl: extItem.webUrl ?? null,
					downloadUrl: extItem.downloadUrl ?? null,
					driveId: extItem.driveId,
					externalItemId: extItem.externalItemId,
					parentItemId: extItem.parentItemId ?? null,
					folderPath,
					isShortcut: extItem.isShortcut,
					targetUrl: extItem.targetUrl ?? null,
					targetDriveId: extItem.targetDriveId ?? null,
					targetItemId: extItem.targetItemId ?? null,
					targetType: extItem.targetType ?? null,
					isArchived,
					etag: extItem.etag ?? null,
					metadata,
					lastSyncedAt: new Date()
				})
				.returning();
			fileRecord = inserted;

			// Record in syncMapping for synchronization abstraction & future retargeting
			await db.insert(syncMapping).values({
				syncConfigId,
				externalId: `${extItem.driveId}:${extItem.externalItemId}`,
				fileId: fileRecord.id,
				providerId: 'microsoft-files',
				etag: extItem.etag ?? null,
				metadata: {
					folderPath,
					webUrl: extItem.webUrl
				}
			});
		}

		// Ensure association with the parent entity
		if (entityType === 'event' && entityId) {
			await db
				.insert(eventFile)
				.values({ eventId: entityId, fileId: fileRecord.id })
				.onConflictDoNothing();
		} else if (entityType === 'announcement' && entityId) {
			await db
				.insert(announcementFile)
				.values({ announcementId: entityId, fileId: fileRecord.id })
				.onConflictDoNothing();
		}

		return fileRecord;
	}

	async fetchDbEntityFiles(
		type: 'event' | 'announcement',
		targetEntityId: string
	): Promise<FileItem[]> {
		if (type === 'event') {
			const rows = await db.query.eventFile.findMany({
				where: eq(eventFile.eventId, targetEntityId),
				with: {
					file: true
				}
			});
			return rows
				.map((r) => r.file)
				.filter(Boolean)
				.map((f) => this.serializeFile(f));
		} else {
			const rows = await db.query.announcementFile.findMany({
				where: eq(announcementFile.announcementId, targetEntityId),
				with: {
					file: true
				}
			});
			return rows
				.map((r) => r.file)
				.filter(Boolean)
				.map((f) => this.serializeFile(f));
		}
	}

	serializeFile(f: typeof file.$inferSelect & { events?: any[]; announcements?: any[] }): FileItem {
		const meta = (f.metadata || {}) as Record<string, any>;
		return {
			...f,
			createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
			updatedAt: f.updatedAt instanceof Date ? f.updatedAt.toISOString() : String(f.updatedAt),
			lastSyncedAt:
				f.lastSyncedAt instanceof Date
					? f.lastSyncedAt.toISOString()
					: f.lastSyncedAt
						? String(f.lastSyncedAt)
						: null,
			remoteChildren: Array.isArray(meta.remoteChildren) ? meta.remoteChildren : undefined,
			linkedEvents: Array.isArray(f.events)
				? f.events
						.map((ef: any) => ef.event)
						.filter(Boolean)
						.map((e: any) => ({
							id: e.id,
							summary: e.summary,
							startDateTime:
								e.startDateTime instanceof Date ? e.startDateTime.toISOString() : e.startDateTime
						}))
				: undefined,
			linkedAnnouncements: Array.isArray(f.announcements)
				? f.announcements
						.map((af: any) => af.announcement)
						.filter(Boolean)
						.map((a: any) => ({
							id: a.id,
							title: a.title
						}))
				: undefined
		};
	}

	async getEntityFolderStatus(
		type: 'event' | 'announcement',
		rawEntityId: string
	): Promise<EntityFolderStatus | null> {
		let targetEntityId = rawEntityId;
		if (type === 'event' && targetEntityId.includes('_inst_')) {
			targetEntityId = await resolveEventIdForAssociations(targetEntityId, {
				materializeIfVirtual: false
			});
		}
		const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
			targetEntityId
		);
		if (!isUuid) return null;

		const [record] = await db
			.select()
			.from(entityFileFolder)
			.where(
				and(
					eq(entityFileFolder.entityType, type),
					eq(entityFileFolder.entityId, targetEntityId)
				)
			)
			.limit(1);

		if (!record) return null;

		return {
			...record,
			createdAt: record.createdAt.toISOString(),
			updatedAt: record.updatedAt.toISOString(),
			lastSyncedAt: record.lastSyncedAt ? record.lastSyncedAt.toISOString() : null
		};
	}
}

export const fileStorageService = new FileStorageService();
