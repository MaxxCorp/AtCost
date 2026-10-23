import type { SyncConfig } from '../sync/types.js';
import { MicrosoftGraphClient } from '../sync/providers/microsoft/client.js';
import type {
	FileStorageProvider,
	StorageTeamSummary,
	StorageChannelSummary,
	StorageSiteSummary,
	StorageDriveSummary,
	StorageFolderRef,
	ExternalStorageItem,
	ResolvedShareTarget
} from './types.js';
import { generateMinimalOfficeFile } from './openxml.js';
import type { RemoteLinkChild } from '@ac/validations';

function encodeSharingUrl(url: string): string {
	const base64 = Buffer.from(url.trim(), 'utf-8')
		.toString('base64')
		.replace(/=+$/g, '')
		.replace(/\//g, '_')
		.replace(/\+/g, '-');
	return `u!${base64}`;
}

function parseInternetShortcutUrl(content: string): string | null {
	const match = content.match(/^URL\s*=\s*(.+)$/im);
	return match ? match[1].trim() : null;
}

function extractExtension(filename: string): string {
	const idx = filename.lastIndexOf('.');
	if (idx <= 0 || idx === filename.length - 1) return '';
	return filename.slice(idx + 1).toLowerCase();
}

function isOfficeExtension(ext: string): boolean {
	return ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'one'].includes(ext.toLowerCase());
}

function isSharePointOrOneDriveUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		const host = parsed.hostname.toLowerCase();
		return (
			host.includes('sharepoint.com') ||
			host.includes('1drv.ms') ||
			host.includes('onedrive.live.com') ||
			host.includes('office.com')
		);
	} catch {
		return false;
	}
}

export class MicrosoftGraphStorageProvider implements FileStorageProvider {
	readonly providerType = 'microsoft-files';
	private client = new MicrosoftGraphClient();
	private config?: SyncConfig;

	async initialize(config: SyncConfig, userId?: string): Promise<void> {
		this.config = config;
		await this.client.initialize({
			...config,
			userId: userId || config.userId
		});
	}

	async initializeDirect(options: {
		userId?: string;
		authMode?: 'auto' | 'app' | 'user';
		mailboxEmail?: string;
	}): Promise<void> {
		await this.client.initialize({
			userId: options.userId,
			authMode: options.authMode || 'auto',
			mailboxEmail: options.mailboxEmail
		});
	}

	async validateConnection(): Promise<{
		success: boolean;
		message: string;
		driveId?: string;
		webUrl?: string;
	}> {
		const settings = (this.config?.settings || {}) as Record<string, any>;
		const driveId = settings.driveId as string | undefined;
		const rootFolderId = settings.rootFolderId as string | undefined;

		if (!driveId) {
			return {
				success: false,
				message: 'No storage drive configured in Library Root settings.'
			};
		}

		try {
			const endpoint =
				rootFolderId && rootFolderId !== 'root'
					? `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(rootFolderId)}`
					: `/drives/${encodeURIComponent(driveId)}/root`;
			const item = await this.client.makeRequest<any>(endpoint);
			return {
				success: true,
				message: `Connected to "${item.name || settings.driveName || 'Drive'}"`,
				driveId,
				webUrl: item.webUrl
			};
		} catch (err: any) {
			return {
				success: false,
				message: err?.message || 'Failed to validate storage connection'
			};
		}
	}

	async listTeams(search?: string): Promise<StorageTeamSummary[]> {
		const teamsMap = new Map<string, StorageTeamSummary>();

		// 1. Try listing Teams via /groups filter (works in App-Only and User modes)
		try {
			const res = await this.client.makeRequest<{ value: any[] }>(
				`/groups?$filter=resourceProvisioningOptions/Any(x:x eq 'Team')&$select=id,displayName,description,mail&$top=100`
			);
			for (const g of res.value || []) {
				if (g.id && g.displayName) {
					teamsMap.set(g.id, {
						id: g.id,
						displayName: g.displayName,
						description: g.description ?? null,
						mail: g.mail ?? null
					});
				}
			}
		} catch {
			// Fallback to /me/joinedTeams if in user mode without Directory.Read.All
			if (this.client.getAuthModeUsed() === 'user') {
				try {
					const joined = await this.client.makeRequest<{ value: any[] }>(
						`/me/joinedTeams?$select=id,displayName,description`
					);
					for (const t of joined.value || []) {
						if (t.id && t.displayName) {
							teamsMap.set(t.id, {
								id: t.id,
								displayName: t.displayName,
								description: t.description ?? null
							});
						}
					}
				} catch {
					// Ignore
				}
			}
		}

		let list = Array.from(teamsMap.values()).sort((a, b) =>
			a.displayName.localeCompare(b.displayName)
		);

		if (search && search.trim()) {
			const q = search.trim().toLowerCase();
			list = list.filter(
				(t) =>
					t.displayName.toLowerCase().includes(q) ||
					(t.description && t.description.toLowerCase().includes(q)) ||
					(t.mail && t.mail.toLowerCase().includes(q))
			);
		}

		return list;
	}

	async listTeamChannels(teamId: string): Promise<StorageChannelSummary[]> {
		const res = await this.client.makeRequest<{ value: any[] }>(
			`/teams/${encodeURIComponent(teamId)}/channels?$select=id,displayName,description,membershipType,webUrl`
		);
		return (res.value || []).map((c: any) => ({
			id: c.id,
			displayName: c.displayName,
			description: c.description ?? null,
			membershipType: c.membershipType,
			webUrl: c.webUrl ?? null
		}));
	}

	async resolveChannelDriveFolder(teamId: string, channelId: string): Promise<StorageFolderRef> {
		try {
			const folder = await this.client.makeRequest<any>(
				`/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/filesFolder`
			);
			const driveId = folder.parentReference?.driveId;
			if (!driveId || !folder.id) {
				throw new Error('Channel filesFolder response missing driveId or itemId');
			}
			return {
				driveId,
				itemId: folder.id,
				name: folder.name,
				path: folder.name,
				webUrl: folder.webUrl
			};
		} catch {
			// Fallback: get the Team group's default document library drive and ensure a folder for the channel
			const channel = await this.client.makeRequest<any>(
				`/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}?$select=id,displayName`
			);
			const drive = await this.client.makeRequest<any>(
				`/groups/${encodeURIComponent(teamId)}/drive?$select=id,name,webUrl`
			);
			const channelName = channel?.displayName || 'General';
			return await this.ensureFolderPath(drive.id, undefined, [channelName]);
		}
	}

	async listSharePointSites(search?: string): Promise<StorageSiteSummary[]> {
		const query = search?.trim() ? encodeURIComponent(search.trim()) : '*';
		const res = await this.client.makeRequest<{ value: any[] }>(
			`/sites?search=${query}&$select=id,name,displayName,webUrl&$top=50`
		);
		return (res.value || []).map((s: any) => ({
			id: s.id,
			name: s.name || s.displayName,
			displayName: s.displayName || s.name,
			webUrl: s.webUrl
		}));
	}

	async listSiteDrives(siteId: string): Promise<StorageDriveSummary[]> {
		const res = await this.client.makeRequest<{ value: any[] }>(
			`/sites/${encodeURIComponent(siteId)}/drives?$select=id,name,driveType,webUrl`
		);
		return (res.value || []).map((d: any) => ({
			id: d.id,
			name: d.name,
			driveType: d.driveType || 'documentLibrary',
			webUrl: d.webUrl
		}));
	}

	async getUserDrive(userEmail?: string): Promise<StorageDriveSummary> {
		const endpoint =
			userEmail && userEmail.trim()
				? `/users/${encodeURIComponent(userEmail.trim())}/drive?$select=id,name,driveType,webUrl,owner`
				: this.client.getAuthModeUsed() === 'user'
					? `/me/drive?$select=id,name,driveType,webUrl,owner`
					: null;

		if (!endpoint) {
			throw new Error(
				'To use an individual OneDrive with App Credentials, please specify the user email address.'
			);
		}

		const d = await this.client.makeRequest<any>(endpoint);
		return {
			id: d.id,
			name: d.name || 'OneDrive',
			driveType: d.driveType || 'business',
			webUrl: d.webUrl,
			ownerName: d.owner?.user?.displayName || userEmail
		};
	}

	async listFolderSubfolders(driveId: string, folderItemId?: string): Promise<StorageFolderRef[]> {
		const endpoint =
			folderItemId && folderItemId !== 'root'
				? `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(folderItemId)}/children?$select=id,name,folder,webUrl,parentReference`
				: `/drives/${encodeURIComponent(driveId)}/root/children?$select=id,name,folder,webUrl,parentReference`;

		const res = await this.client.makeRequest<{ value: any[] }>(endpoint);
		return (res.value || [])
			.filter((item: any) => Boolean(item.folder))
			.map((item: any) => ({
				driveId,
				itemId: item.id,
				name: item.name,
				path: item.name,
				webUrl: item.webUrl
			}));
	}

	async ensureFolderPath(
		driveId: string,
		rootFolderId: string | undefined,
		segments: string[]
	): Promise<StorageFolderRef> {
		let currentParentId = rootFolderId && rootFolderId !== 'root' ? rootFolderId : 'root';
		let currentWebUrl: string | undefined;
		let currentName = 'root';
		const builtSegments: string[] = [];

		for (const rawSegment of segments) {
			const segment = rawSegment.trim();
			if (!segment) continue;

			builtSegments.push(segment);

			// 1. Check if folder already exists under currentParentId
			const childrenEndpoint =
				currentParentId === 'root'
					? `/drives/${encodeURIComponent(driveId)}/root/children?$select=id,name,folder,webUrl`
					: `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(currentParentId)}/children?$select=id,name,folder,webUrl`;

			let existingFolder: any = null;
			try {
				const childrenRes = await this.client.makeRequest<{ value: any[] }>(childrenEndpoint);
				existingFolder = (childrenRes.value || []).find(
					(c: any) => c.folder && c.name?.toLowerCase() === segment.toLowerCase()
				);
			} catch {
				// Ignore and attempt creation
			}

			if (existingFolder) {
				currentParentId = existingFolder.id;
				currentName = existingFolder.name;
				currentWebUrl = existingFolder.webUrl;
				continue;
			}

			// 2. Create the folder if it doesn't exist
			const createEndpoint =
				currentParentId === 'root'
					? `/drives/${encodeURIComponent(driveId)}/root/children`
					: `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(currentParentId)}/children`;

			const created = await this.client.makeRequest<any>(createEndpoint, {
				method: 'POST',
				body: JSON.stringify({
					name: segment,
					folder: {},
					'@microsoft.graph.conflictBehavior': 'replace'
				})
			});

			currentParentId = created.id;
			currentName = created.name || segment;
			currentWebUrl = created.webUrl;
		}

		return {
			driveId,
			itemId: currentParentId,
			name: currentName,
			path: builtSegments.join('/'),
			webUrl: currentWebUrl
		};
	}

	async moveOrRenameFolder(
		driveId: string,
		itemId: string,
		newParentId: string,
		newName?: string
	): Promise<StorageFolderRef> {
		const body: Record<string, any> = {
			parentReference: {
				id: newParentId
			}
		};
		if (newName) {
			body.name = newName;
		}

		const updated = await this.client.makeRequest<any>(
			`/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`,
			{
				method: 'PATCH',
				body: JSON.stringify(body)
			}
		);

		return {
			driveId,
			itemId: updated.id,
			name: updated.name,
			path: updated.name,
			webUrl: updated.webUrl
		};
	}

	async listFolderChildren(driveId: string, folderItemId: string): Promise<ExternalStorageItem[]> {
		const endpoint =
			!folderItemId || folderItemId === 'root'
				? `/drives/${encodeURIComponent(driveId)}/root/children`
				: `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(folderItemId)}/children`;

		const res = await this.client.makeRequest<{ value: any[] }>(endpoint);
		const rawItems = res.value || [];
		const results: ExternalStorageItem[] = [];

		for (const item of rawItems) {
			const ext = extractExtension(item.name || '');

			// Case 1: Native OneDrive/SharePoint shortcut (remoteItem facet)
			if (item.remoteItem) {
				const remote = item.remoteItem;
				const targetDriveId = remote.parentReference?.driveId;
				const targetItemId = remote.id;
				const isRemoteFolder = Boolean(remote.folder);
				let remoteChildren: RemoteLinkChild[] | undefined;

				if (isRemoteFolder && targetDriveId && targetItemId) {
					remoteChildren = await this.fetchRemoteFolderChildren(targetDriveId, targetItemId);
				}

				results.push({
					externalItemId: item.id,
					driveId,
					parentItemId: folderItemId,
					name: item.name,
					itemType: 'link',
					mimeType: remote.file?.mimeType || (isRemoteFolder ? 'folder/shortcut' : 'application/octet-stream'),
					extension: ext,
					size: remote.size ?? item.size ?? 0,
					webUrl: remote.webUrl || item.webUrl,
					etag: item.eTag,
					isShortcut: true,
					targetUrl: remote.webUrl || item.webUrl,
					targetDriveId,
					targetItemId,
					targetType: isRemoteFolder ? 'folder' : 'file',
					remoteChildren,
					lastModifiedDateTime: item.lastModifiedDateTime,
					createdBy: item.createdBy?.user?.displayName
				});
				continue;
			}

			// Case 2: SharePoint / Teams .url Internet Shortcut file
			if (ext === 'url' && item.file) {
				let targetUrl: string | undefined;
				let resolvedTarget: ResolvedShareTarget | null = null;

				try {
					const contentText = await this.downloadSmallTextFile(driveId, item.id, item['@microsoft.graph.downloadUrl']);
					if (contentText) {
						targetUrl = parseInternetShortcutUrl(contentText) ?? undefined;
					}
					if (targetUrl && isSharePointOrOneDriveUrl(targetUrl)) {
						resolvedTarget = await this.resolveShareLink(targetUrl);
					}
				} catch {
					// Keep basic .url metadata even if resolution fails
				}

				results.push({
					externalItemId: item.id,
					driveId,
					parentItemId: folderItemId,
					name: item.name.replace(/\.url$/i, ''),
					itemType: 'link',
					mimeType: resolvedTarget?.mimeType || 'text/uri-list',
					extension: 'url',
					size: resolvedTarget?.size ?? item.size ?? 0,
					webUrl: resolvedTarget?.webUrl || targetUrl || item.webUrl,
					etag: item.eTag,
					isShortcut: true,
					targetUrl: targetUrl || item.webUrl,
					targetDriveId: resolvedTarget?.driveId,
					targetItemId: resolvedTarget?.itemId,
					targetType: resolvedTarget?.targetType || 'external_url',
					remoteChildren: resolvedTarget?.children,
					lastModifiedDateTime: item.lastModifiedDateTime,
					createdBy: item.createdBy?.user?.displayName
				});
				continue;
			}

			// Case 3: Subfolder inside the entity folder
			if (item.folder) {
				const remoteChildren = await this.fetchRemoteFolderChildren(driveId, item.id);
				results.push({
					externalItemId: item.id,
					driveId,
					parentItemId: folderItemId,
					name: item.name,
					itemType: 'folder',
					mimeType: 'folder',
					extension: '',
					size: item.size ?? 0,
					webUrl: item.webUrl,
					etag: item.eTag,
					isShortcut: false,
					targetType: 'folder',
					remoteChildren,
					lastModifiedDateTime: item.lastModifiedDateTime,
					createdBy: item.createdBy?.user?.displayName
				});
				continue;
			}

			// Case 4: Standard File / Office Document
			results.push({
				externalItemId: item.id,
				driveId,
				parentItemId: folderItemId,
				name: item.name,
				itemType: isOfficeExtension(ext) ? 'office_doc' : 'file',
				mimeType: item.file?.mimeType || 'application/octet-stream',
				extension: ext,
				size: item.size ?? 0,
				webUrl: item.webUrl,
				downloadUrl: item['@microsoft.graph.downloadUrl'],
				etag: item.eTag,
				isShortcut: false,
				lastModifiedDateTime: item.lastModifiedDateTime,
				createdBy: item.createdBy?.user?.displayName
			});
		}

		return results;
	}

	private async fetchRemoteFolderChildren(
		driveId: string,
		folderItemId: string
	): Promise<RemoteLinkChild[]> {
		try {
			const res = await this.client.makeRequest<{ value: any[] }>(
				`/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(folderItemId)}/children?$top=50&$select=id,name,webUrl,size,file,folder,lastModifiedDateTime`
			);
			return (res.value || []).map((c: any) => ({
				id: c.id,
				name: c.name,
				webUrl: c.webUrl,
				size: c.size,
				mimeType: c.file?.mimeType,
				isFolder: Boolean(c.folder),
				lastModifiedDateTime: c.lastModifiedDateTime
			}));
		} catch {
			return [];
		}
	}

	private async downloadSmallTextFile(
		driveId: string,
		itemId: string,
		downloadUrl?: string
	): Promise<string | null> {
		try {
			if (downloadUrl) {
				const res = await fetch(downloadUrl);
				if (res.ok) {
					return await res.text();
				}
			}
			const item = await this.client.makeRequest<any>(
				`/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`
			);
			if (item?.['@microsoft.graph.downloadUrl']) {
				const res = await fetch(item['@microsoft.graph.downloadUrl']);
				if (res.ok) {
					return await res.text();
				}
			}
		} catch {
			// Ignore
		}
		return null;
	}

	async createOfficeFile(
		driveId: string,
		parentFolderId: string,
		fileName: string,
		docType: 'docx' | 'xlsx' | 'pptx' | 'txt' | 'md'
	): Promise<ExternalStorageItem> {
		const cleanBaseName = fileName.replace(/\.(docx|xlsx|pptx|txt|md)$/i, '').trim() || 'Document';
		const { content, mimeType, extension } = generateMinimalOfficeFile(docType, cleanBaseName);
		const finalName = `${cleanBaseName}.${extension}`;

		return await this.uploadFile(driveId, parentFolderId, finalName, content, mimeType);
	}

	async uploadFile(
		driveId: string,
		parentFolderId: string,
		fileName: string,
		content: Uint8Array,
		mimeType = 'application/octet-stream'
	): Promise<ExternalStorageItem> {
		const sanitizedName = fileName.replace(/["*:<>?/\\|]/g, '_').trim() || 'file';
		const endpoint =
			!parentFolderId || parentFolderId === 'root'
				? `/drives/${encodeURIComponent(driveId)}/root:/${encodeURIComponent(sanitizedName)}:/content`
				: `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(parentFolderId)}:/${encodeURIComponent(sanitizedName)}:/content`;

		const item = await this.client.makeRequest<any>(endpoint, {
			method: 'PUT',
			headers: {
				'Content-Type': mimeType
			},
			body: Buffer.from(content)
		});

		const ext = extractExtension(item.name || sanitizedName);
		return {
			externalItemId: item.id,
			driveId,
			parentItemId: parentFolderId,
			name: item.name || sanitizedName,
			itemType: isOfficeExtension(ext) ? 'office_doc' : 'file',
			mimeType: item.file?.mimeType || mimeType,
			extension: ext,
			size: item.size ?? content.byteLength,
			webUrl: item.webUrl,
			downloadUrl: item['@microsoft.graph.downloadUrl'],
			etag: item.eTag,
			isShortcut: false,
			lastModifiedDateTime: item.lastModifiedDateTime
		};
	}

	async createShortcutFile(
		driveId: string,
		parentFolderId: string,
		shortcutName: string,
		targetUrl: string
	): Promise<ExternalStorageItem> {
		const cleanName = shortcutName.replace(/\.url$/i, '').replace(/["*:<>?/\\|]/g, '_').trim() || 'Link';
		const fileName = `${cleanName}.url`;
		const shortcutContent = `[InternetShortcut]\r\nURL=${targetUrl.trim()}\r\n`;
		const bytes = new TextEncoder().encode(shortcutContent);

		const uploaded = await this.uploadFile(
			driveId,
			parentFolderId,
			fileName,
			bytes,
			'application/internet-shortcut'
		);

		let resolved: ResolvedShareTarget | null = null;
		if (isSharePointOrOneDriveUrl(targetUrl)) {
			resolved = await this.resolveShareLink(targetUrl);
		}

		return {
			...uploaded,
			name: cleanName,
			itemType: 'link',
			extension: 'url',
			isShortcut: true,
			webUrl: resolved?.webUrl || targetUrl,
			targetUrl,
			targetDriveId: resolved?.driveId,
			targetItemId: resolved?.itemId,
			targetType: resolved?.targetType || 'external_url',
			remoteChildren: resolved?.children
		};
	}

	async resolveShareLink(url: string): Promise<ResolvedShareTarget | null> {
		const trimmed = url.trim();
		if (!isSharePointOrOneDriveUrl(trimmed)) {
			return {
				name: trimmed.split('/').pop() || 'External Link',
				webUrl: trimmed,
				targetType: 'external_url'
			};
		}

		try {
			const shareToken = encodeSharingUrl(trimmed);
			const driveItem = await this.client.makeRequest<any>(
				`/shares/${encodeURIComponent(shareToken)}/driveItem?$expand=children($top=50;$select=id,name,webUrl,size,file,folder,lastModifiedDateTime)`
			);

			if (!driveItem || !driveItem.id) {
				return null;
			}

			const isFolder = Boolean(driveItem.folder);
			const children: RemoteLinkChild[] | undefined = isFolder
				? (driveItem.children || []).map((c: any) => ({
						id: c.id,
						name: c.name,
						webUrl: c.webUrl,
						size: c.size,
						mimeType: c.file?.mimeType,
						isFolder: Boolean(c.folder),
						lastModifiedDateTime: c.lastModifiedDateTime
					}))
				: undefined;

			return {
				driveId: driveItem.parentReference?.driveId,
				itemId: driveItem.id,
				name: driveItem.name || 'Shared Item',
				webUrl: driveItem.webUrl || trimmed,
				mimeType: driveItem.file?.mimeType || (isFolder ? 'folder' : undefined),
				size: driveItem.size,
				targetType: isFolder ? 'folder' : 'file',
				children
			};
		} catch {
			// If Graph /shares cannot resolve (e.g. external tenant link), still return structured URL metadata
			return {
				name: decodeURIComponent(trimmed.split('/').pop()?.split('?')[0] || 'SharePoint Link'),
				webUrl: trimmed,
				targetType: 'external_url'
			};
		}
	}

	async deleteExternalItem(driveId: string, itemId: string): Promise<void> {
		await this.client.makeRequest(
			`/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`,
			{
				method: 'DELETE'
			}
		);
	}
}
