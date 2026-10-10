import * as v from 'valibot';

export interface SyncExecutionState {
	status: 'idle' | 'pending' | 'synced' | 'unpublishing' | 'failed';
	externalId?: string;
	etag?: string;
	lastSyncedAt?: string;
	error?: string;
	metadata?: Record<string, any>;
}

export interface CampaignContent {
	version: 1;
	targets: Record<string, {
		enabled: boolean;
		settings?: Record<string, any>;
	}>;
	items: Record<string, {
		entityType: 'event' | 'announcement';
		syncs: Record<string, SyncExecutionState>;
	}>;
	externalIds: Record<string, {
		itemId: string;
		configId: string;
	}>;
}

export const syncExecutionStateSchema = v.object({
	status: v.picklist(['idle', 'pending', 'synced', 'unpublishing', 'failed']),
	externalId: v.optional(v.string()),
	etag: v.optional(v.string()),
	lastSyncedAt: v.optional(v.string()),
	error: v.optional(v.string()),
	metadata: v.optional(v.record(v.string(), v.any()))
});

export const campaignContentSchema = v.object({
	version: v.literal(1),
	targets: v.record(
		v.string(),
		v.object({
			enabled: v.boolean(),
			settings: v.optional(v.record(v.string(), v.any()))
		})
	),
	items: v.record(
		v.string(),
		v.object({
			entityType: v.picklist(['event', 'announcement']),
			syncs: v.record(v.string(), syncExecutionStateSchema)
		})
	),
	externalIds: v.record(
		v.string(),
		v.object({
			itemId: v.string(),
			configId: v.string()
		})
	)
});

/**
 * Helper to get active sync target IDs for a campaign.
 * Supports both new CampaignContent and legacy { syncIds: [...] } structure.
 */
export function getCampaignTargetIds(content: any): string[] {
	if (!content) return [];
	if (content.version === 1 && content.targets) {
		return Object.entries(content.targets)
			.filter(([_, t]: [string, any]) => t.enabled)
			.map(([id]) => id);
	}
	if (Array.isArray(content.syncIds)) {
		return content.syncIds;
	}
	return [];
}

/**
 * Helper to retrieve sync execution state for an item.
 */
export function getItemSyncState(
	content: any,
	itemId: string,
	configId: string
): SyncExecutionState | undefined {
	if (!content || content.version !== 1 || !content.items) return undefined;
	return content.items[itemId]?.syncs?.[configId];
}

/**
 * Helper to initialize or ensure valid CampaignContent structure.
 */
export function createDefaultCampaignContent(syncIds: string[] = []): CampaignContent {
	const targets: Record<string, { enabled: boolean }> = {};
	for (const id of syncIds) {
		targets[id] = { enabled: true };
	}
	return {
		version: 1,
		targets,
		items: {},
		externalIds: {}
	};
}
