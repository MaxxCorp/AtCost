import type { SyncConfig } from '../sync/types.js';
import type { RemoteLinkChild } from '@ac/validations';

export interface StorageTeamSummary {
	id: string;
	displayName: string;
	description?: string | null;
	mail?: string | null;
}

export interface StorageChannelSummary {
	id: string;
	displayName: string;
	description?: string | null;
	membershipType?: string;
	webUrl?: string | null;
}

export interface StorageSiteSummary {
	id: string;
	name: string;
	displayName: string;
	webUrl: string;
}

export interface StorageDriveSummary {
	id: string;
	name: string;
	driveType: string;
	webUrl: string;
	ownerName?: string;
}

export interface StorageFolderRef {
	driveId: string;
	itemId: string;
	name: string;
	path: string;
	webUrl?: string;
}

export interface ResolvedShareTarget {
	driveId?: string;
	itemId?: string;
	name: string;
	webUrl: string;
	mimeType?: string;
	size?: number;
	targetType: 'file' | 'folder' | 'external_url';
	children?: RemoteLinkChild[];
}

export interface ExternalStorageItem {
	externalItemId: string;
	driveId: string;
	parentItemId?: string;
	name: string;
	itemType: 'file' | 'folder' | 'link' | 'office_doc';
	mimeType?: string;
	extension?: string;
	size?: number;
	webUrl?: string;
	downloadUrl?: string;
	etag?: string;
	isShortcut: boolean;
	targetUrl?: string;
	targetDriveId?: string;
	targetItemId?: string;
	targetType?: 'file' | 'folder' | 'external_url';
	remoteChildren?: RemoteLinkChild[];
	lastModifiedDateTime?: string;
	createdBy?: string;
}

/**
 * Storage provider interface abstracting file & folder operations across cloud backends
 * (Microsoft Teams / SharePoint / OneDrive, and future backends like Nextcloud or Google Drive).
 */
export interface FileStorageProvider {
	readonly providerType: string;

	initialize(config: SyncConfig, userId?: string): Promise<void>;
	validateConnection(): Promise<{
		success: boolean;
		message: string;
		driveId?: string;
		webUrl?: string;
	}>;

	// Discovery
	listTeams(search?: string): Promise<StorageTeamSummary[]>;
	listTeamChannels(teamId: string): Promise<StorageChannelSummary[]>;
	resolveChannelDriveFolder(teamId: string, channelId: string): Promise<StorageFolderRef>;
	listSharePointSites(search?: string): Promise<StorageSiteSummary[]>;
	listSiteDrives(siteId: string): Promise<StorageDriveSummary[]>;
	getUserDrive(userEmail?: string): Promise<StorageDriveSummary>;
	listFolderSubfolders(driveId: string, folderItemId?: string): Promise<StorageFolderRef[]>;

	// Folder hierarchy management
	ensureFolderPath(
		driveId: string,
		rootFolderId: string | undefined,
		segments: string[]
	): Promise<StorageFolderRef>;

	moveOrRenameFolder(
		driveId: string,
		itemId: string,
		newParentId: string,
		newName?: string
	): Promise<StorageFolderRef>;

	// File & Link operations
	listFolderChildren(driveId: string, folderItemId: string): Promise<ExternalStorageItem[]>;

	createOfficeFile(
		driveId: string,
		parentFolderId: string,
		fileName: string,
		docType: 'docx' | 'xlsx' | 'pptx' | 'txt' | 'md'
	): Promise<ExternalStorageItem>;

	uploadFile(
		driveId: string,
		parentFolderId: string,
		fileName: string,
		content: Uint8Array,
		mimeType?: string
	): Promise<ExternalStorageItem>;

	createShortcutFile(
		driveId: string,
		parentFolderId: string,
		shortcutName: string,
		targetUrl: string
	): Promise<ExternalStorageItem>;

	resolveShareLink(url: string): Promise<ResolvedShareTarget | null>;

	deleteExternalItem(driveId: string, itemId: string): Promise<void>;
}
