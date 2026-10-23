import * as v from 'valibot';
import type { DbFile, EntityFileFolder } from '@ac/db';

export interface RemoteLinkChild {
    id: string;
    name: string;
    webUrl?: string;
    size?: number;
    mimeType?: string;
    isFolder: boolean;
    lastModifiedDateTime?: string;
}

export type FileItem = Omit<DbFile, 'createdAt' | 'updatedAt' | 'lastSyncedAt'> & {
    createdAt: string;
    updatedAt: string;
    lastSyncedAt?: string | null;
    remoteChildren?: RemoteLinkChild[];
    linkedEvents?: Array<{ id: string; summary: string; startDateTime?: string | null }>;
    linkedAnnouncements?: Array<{ id: string; title: string }>;
};

export type EntityFolderStatus = Omit<EntityFileFolder, 'createdAt' | 'updatedAt' | 'lastSyncedAt'> & {
    createdAt: string;
    updatedAt: string;
    lastSyncedAt?: string | null;
};

export interface LibraryRootSettings {
    targetType: 'teams_channel' | 'sharepoint_site' | 'user_onedrive';
    authMode: 'auto' | 'app' | 'user';
    teamId?: string;
    teamName?: string;
    channelId?: string;
    channelName?: string;
    siteId?: string;
    siteName?: string;
    driveId: string;
    driveName?: string;
    rootFolderId?: string;
    rootFolderPath?: string;
    webUrl?: string;
    userEmail?: string;
    eventsFolderName: string;
    announcementsFolderName: string;
    archiveFolderName: string;
    autoArchivePastEvents: boolean;
    isDefault?: boolean;
}

export const filePaginationSchema = v.optional(v.object({
    page: v.optional(v.number(), 1),
    limit: v.optional(v.number(), 50),
    search: v.optional(v.string()),
    itemType: v.optional(v.string()),
    isArchived: v.optional(v.union([v.boolean(), v.string()])),
    entityType: v.optional(v.picklist(['event', 'announcement'])),
    entityId: v.optional(v.string()),
    sortField: v.optional(v.union([
        v.literal('name'),
        v.literal('itemType'),
        v.literal('size'),
        v.literal('createdAt'),
        v.literal('updatedAt'),
    ])),
    sortOrder: v.optional(v.union([v.literal('asc'), v.literal('desc')])),
}), {});

export const createFileSchema = v.object({
    name: v.pipe(v.string(), v.minLength(1, 'File name is required')),
    description: v.optional(v.string()),
    creationMode: v.optional(v.picklist(['office_doc', 'upload', 'link']), 'office_doc'),
    officeDocType: v.optional(v.picklist(['docx', 'xlsx', 'pptx', 'txt', 'md']), 'docx'),
    targetUrl: v.optional(v.string()),
    createShortcutInFolder: v.optional(v.union([
        v.boolean(),
        v.pipe(v.string(), v.transform((val) => val === 'true' || val === 'on'))
    ])),
    fileContentBase64: v.optional(v.string()),
    fileMimeType: v.optional(v.string()),
    fileSize: v.optional(v.union([
        v.number(),
        v.pipe(v.string(), v.transform((val) => parseInt(val, 10) || 0))
    ])),
    entityType: v.optional(v.picklist(['event', 'announcement'])),
    entityId: v.optional(v.string()),
});

export const updateFileSchema = v.object({
    id: v.pipe(v.string(), v.minLength(1)),
    name: v.pipe(v.string(), v.minLength(1, 'File name is required')),
    description: v.optional(v.string()),
    targetUrl: v.optional(v.string()),
    isArchived: v.optional(v.union([
        v.boolean(),
        v.pipe(v.string(), v.transform((val) => val === 'true' || val === 'on'))
    ])),
});

export const fileAssociationSchema = v.object({
    type: v.picklist(['event', 'announcement']),
    entityId: v.string(),
    fileId: v.optional(v.pipe(v.string(), v.uuid())),
    itemId: v.optional(v.pipe(v.string(), v.uuid())),
});

export const getFileAssociationsSchema = v.object({
    type: v.picklist(['event', 'announcement']),
    entityId: v.string(),
});

export const syncEntityFolderSchema = v.object({
    type: v.picklist(['event', 'announcement']),
    entityId: v.string(),
    forceEnsure: v.optional(v.boolean()),
});

export const toggleEntityFolderArchiveSchema = v.object({
    type: v.picklist(['event', 'announcement']),
    entityId: v.string(),
    isArchived: v.boolean(),
});

export const resolveShareLinkSchema = v.object({
    url: v.pipe(v.string(), v.minLength(1, 'URL is required')),
    fileId: v.optional(v.pipe(v.string(), v.uuid())),
});

export const saveLibraryRootConfigSchema = v.object({
    id: v.optional(v.string()),
    name: v.pipe(v.string(), v.minLength(1, 'Configuration name is required')),
    targetType: v.picklist(['teams_channel', 'sharepoint_site', 'user_onedrive']),
    authMode: v.optional(v.picklist(['auto', 'app', 'user']), 'auto'),
    teamId: v.optional(v.string()),
    teamName: v.optional(v.string()),
    channelId: v.optional(v.string()),
    channelName: v.optional(v.string()),
    siteId: v.optional(v.string()),
    siteName: v.optional(v.string()),
    driveId: v.pipe(v.string(), v.minLength(1, 'Storage drive is required')),
    driveName: v.optional(v.string()),
    rootFolderId: v.optional(v.string()),
    rootFolderPath: v.optional(v.string()),
    webUrl: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    eventsFolderName: v.optional(v.string(), 'Events'),
    announcementsFolderName: v.optional(v.string(), 'Announcements'),
    archiveFolderName: v.optional(v.string(), 'Archive'),
    autoArchivePastEvents: v.optional(v.union([
        v.boolean(),
        v.pipe(v.string(), v.transform((val) => val === 'true' || val === 'on'))
    ])),
});
