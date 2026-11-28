import {
    ABLY_API_KEY,
    VERCEL,
    CF_PAGES,
    ENABLE_REALTIME_POLLING,
    FORCE_ABLY
} from '$app/env/private';
import { getRequestEvent } from '$app/server';
import { EventEmitter } from 'events';

// Lazy initialization to avoid connecting if not configured or during build
let restClient: any = null;

function getOriginTabIdFromRequest(): string | undefined {
    try {
        return getRequestEvent()?.request.headers.get('x-ac-tab-id') ?? undefined;
    } catch {
        return undefined;
    }
}

export async function getClient() {
    if (!restClient && ABLY_API_KEY) {
        try {
            // @ts-ignore
            const Ably = (await import('ably')).default;
            restClient = new Ably.Rest(ABLY_API_KEY);
        } catch(e) {
            console.error('Failed to load Ably module', e);
        }
    }
    return restClient;
}

export const CHANNELS = {
    EVENT_CHANGES: 'event-changes',
    ANNOUNCEMENT_CHANGES: 'announcement-changes'
} as const;

export function getEntityChannelName(entityType: string, id: string): string {
    return `entity:${entityType}:${id}`;
}

export function getEntityListChannelName(entityType: string): string {
    return `entity-list:${entityType}`;
}

const ENTITY_CHANNEL_RE = /^entity:[a-z-]+:[a-zA-Z0-9_.:-]+$/;
const LIST_CHANNEL_RE = /^entity-list:[a-z-]+$/;
const LEGACY_CHANNEL_RE = /^(event-changes|announcement-changes)$/;

export function isValidRealtimeChannel(channel: string): boolean {
    return ENTITY_CHANNEL_RE.test(channel) || LIST_CHANNEL_RE.test(channel) || LEGACY_CHANNEL_RE.test(channel);
}

export type EventChangeType = 'create' | 'update' | 'delete';
export type EntityChangeAction = EventChangeType;

export interface RealtimeActor {
    id: string;
    name?: string;
    email?: string;
}

export interface EventChangeMessage {
    type: EventChangeType;
    action?: EntityChangeAction;
    entityType?: string;
    ids: string[];
    eventIds?: string[];
    timestamp: number;
    originTabId?: string;
    updatedBy?: RealtimeActor;
}

export interface EntityChangeMessage {
    entityType: string;
    id: string;
    ids?: string[];
    action: EventChangeType;
    type?: EventChangeType;
    updatedBy?: RealtimeActor;
    originTabId?: string;
    timestamp: number;
    fields?: Record<string, any>;
}

export type RealtimeProviderType = 'sse' | 'ably' | 'polling' | 'none';

export interface RealtimeInfo {
    provider: RealtimeProviderType;
    supportsLiveQueries: boolean;
    ablyConfigured: boolean;
    isPermanentServer: boolean;
    pollingEnabled: boolean;
    reason?: string;
}

/**
 * Detect whether the application is running in a serverless or edge environment
 * (e.g. Vercel Serverless Functions, Cloudflare Pages/Workers, AWS Lambda, Netlify)
 */
export function isServerlessEnvironment(): boolean {
    if (VERCEL === '1' || process.env.VERCEL === '1') return true;
    if (CF_PAGES === '1' || process.env.CF_PAGES === '1') return true;
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) return true;
    if (process.env.NETLIFY === 'true') return true;
    return false;
}

/**
 * Negotiate the optimal realtime provider based on environment and configuration:
 * 1. Full/Permanent server is preferred for cost ($0 in-process SSE / SvelteKit query.live instead of cloud messaging fees).
 * 2. Serverless/Edge uses Ably if ABLY_API_KEY is configured.
 * 3. Polling requires explicit opt-in (ENABLE_REALTIME_POLLING=true) to prevent high serverless function costs.
 * 4. Otherwise, realtime is disabled with an explanatory reason.
 */
export function getRealtimeInfo(): RealtimeInfo {
    const isPermanent = !isServerlessEnvironment();
    const ablyConfigured = !!ABLY_API_KEY;
    const pollingEnabled = ENABLE_REALTIME_POLLING === 'true' || process.env.ENABLE_REALTIME_POLLING === 'true';

    // Priority 1: Full / Permanent server (Cost: $0 - uses built-in server memory & SSE / query.live)
    // Only use Ably on permanent server if FORCE_ABLY is explicitly set
    if (isPermanent && FORCE_ABLY !== 'true') {
        return {
            provider: 'sse',
            supportsLiveQueries: true,
            ablyConfigured,
            isPermanentServer: true,
            pollingEnabled
        };
    }

    // Priority 2: Serverless / Edge with Ably configured (or permanent server with FORCE_ABLY)
    if (ablyConfigured) {
        return {
            provider: 'ably',
            supportsLiveQueries: false,
            ablyConfigured: true,
            isPermanentServer: isPermanent,
            pollingEnabled
        };
    }

    // Priority 3: Polling ONLY if explicitly configured (to avoid serverless invocation costs)
    if (pollingEnabled) {
        return {
            provider: 'polling',
            supportsLiveQueries: false,
            ablyConfigured: false,
            isPermanentServer: isPermanent,
            pollingEnabled: true
        };
    }

    // Real-time collaboration unavailable
    return {
        provider: 'none',
        supportsLiveQueries: false,
        ablyConfigured: false,
        isPermanentServer: isPermanent,
        pollingEnabled: false,
        reason: 'Real-time collaboration is disabled in this serverless environment (ABLY_API_KEY is not configured and ENABLE_REALTIME_POLLING is disabled to prevent invocation costs).'
    };
}

/**
 * In-memory pub/sub and presence tracker for permanent server environments.
 * Used when running on Node.js containers / persistent servers without Ably.
 */
class LocalRealtimeHub {
    private emitter = new EventEmitter();
    private rooms = new Map<string, Map<string, { member: any; lastSeen: number }>>();

    constructor() {
        this.emitter.setMaxListeners(200);
    }

    publish(channel: string, message: any) {
        this.emitter.emit(channel, message);
    }

    subscribe(channel: string, listener: (data: any) => void) {
        this.emitter.on(channel, listener);
        return () => {
            this.emitter.off(channel, listener);
        };
    }

    enterPresence(channel: string, member: any) {
        let room = this.rooms.get(channel);
        if (!room) {
            room = new Map();
            this.rooms.set(channel, room);
        }
        room.set(member.connectionId, { member, lastSeen: Date.now() });
        this.emitter.emit(`${channel}:presence`, {
            action: 'enter',
            member,
            members: Array.from(room.values()).map((r) => r.member)
        });
    }

    updatePresence(channel: string, connectionId: string, data: any) {
        const room = this.rooms.get(channel);
        if (!room) return;
        const existing = room.get(connectionId);
        if (existing) {
            existing.member = { ...existing.member, ...data };
            existing.lastSeen = Date.now();
            this.emitter.emit(`${channel}:presence`, {
                action: 'update',
                member: existing.member,
                members: Array.from(room.values()).map((r) => r.member)
            });
        }
    }

    leavePresence(channel: string, connectionId: string) {
        const room = this.rooms.get(channel);
        if (!room) return;
        const existing = room.get(connectionId);
        if (existing) {
            room.delete(connectionId);
            this.emitter.emit(`${channel}:presence`, {
                action: 'leave',
                member: existing.member,
                members: Array.from(room.values()).map((r) => r.member)
            });
        }
        if (room.size === 0) {
            this.rooms.delete(channel);
        }
    }

    getPresenceMembers(channel: string) {
        const room = this.rooms.get(channel);
        if (!room) return [];
        return Array.from(room.values()).map((r) => r.member);
    }
}

export const localRealtimeHub = new LocalRealtimeHub();

/**
 * Broadcast change notifications across both entity-specific and collection channels
 * for both local SSE (persistent servers) and Ably REST (serverless/edge).
 */
export async function publishEntityChanges(options: {
    entityType: string;
    action: EntityChangeAction;
    ids: string[];
    updatedBy?: RealtimeActor;
    originTabId?: string;
    fields?: Record<string, any>;
}): Promise<void> {
    const uniqueIds = Array.from(new Set(options.ids.filter(Boolean)));
    if (uniqueIds.length === 0) return;

    const timestamp = Date.now();
    const originTabId = options.originTabId ?? getOriginTabIdFromRequest();
    const listChannel = getEntityListChannelName(options.entityType);

    const listMessage: EventChangeMessage = {
        type: options.action,
        action: options.action,
        entityType: options.entityType,
        ids: uniqueIds,
        ...(options.entityType === 'event' ? { eventIds: uniqueIds } : {}),
        timestamp,
        ...(originTabId ? { originTabId } : {}),
        ...(options.updatedBy ? { updatedBy: options.updatedBy } : {})
    };

    const collectionChannels = [listChannel];
    if (options.entityType === 'event') {
        collectionChannels.push(CHANNELS.EVENT_CHANGES);
    } else if (options.entityType === 'announcement') {
        collectionChannels.push(CHANNELS.ANNOUNCEMENT_CHANGES);
    }

    // 1. Broadcast to local in-memory hub (permanent server SSE)
    for (const channel of collectionChannels) {
        localRealtimeHub.publish(channel, listMessage);
    }
    for (const id of uniqueIds) {
        const entityMessage: EntityChangeMessage = {
            entityType: options.entityType,
            id,
            ids: [id],
            action: options.action,
            type: options.action,
            timestamp,
            ...(originTabId ? { originTabId } : {}),
            ...(options.updatedBy ? { updatedBy: options.updatedBy } : {}),
            ...(options.fields ? { fields: options.fields } : {})
        };
        localRealtimeHub.publish(getEntityChannelName(options.entityType, id), entityMessage);
    }

    // 2. Broadcast to Ably if configured
    const client = await getClient();
    if (!client) return;

    try {
        const publishes: Promise<unknown>[] = collectionChannels.map((channel) =>
            client.channels.get(channel).publish('change', listMessage)
        );
        for (const id of uniqueIds) {
            const entityMessage: EntityChangeMessage = {
                entityType: options.entityType,
                id,
                ids: [id],
                action: options.action,
                type: options.action,
                timestamp,
                ...(originTabId ? { originTabId } : {}),
                ...(options.updatedBy ? { updatedBy: options.updatedBy } : {}),
                ...(options.fields ? { fields: options.fields } : {})
            };
            publishes.push(client.channels.get(getEntityChannelName(options.entityType, id)).publish('change', entityMessage));
        }
        await Promise.allSettled(publishes);
    } catch (error) {
        console.error(`Failed to publish ${options.entityType} changes to Ably:`, error);
    }
}

/**
 * Publish a change notification for a specific entity
 */
export async function publishEntityChange(
    entityType: string,
    id: string,
    change: {
        action: EventChangeType;
        updatedBy?: RealtimeActor;
        originTabId?: string;
        fields?: Record<string, any>;
    }
) {
    await publishEntityChanges({
        entityType,
        action: change.action,
        ids: [id],
        updatedBy: change.updatedBy,
        originTabId: change.originTabId,
        fields: change.fields
    });
}

/**
 * Publish an event change notification
 */
export async function publishEventChange(
    type: EventChangeType,
    ids: string[],
    updatedBy?: RealtimeActor,
    originTabId?: string
) {
    await publishEntityChanges({
        entityType: 'event',
        action: type,
        ids,
        updatedBy,
        originTabId
    });
}

/**
 * Publish an announcement change notification
 */
export async function publishAnnouncementChange(
    type: EventChangeType,
    ids: string[],
    updatedBy?: RealtimeActor,
    originTabId?: string
) {
    await publishEntityChanges({
        entityType: 'announcement',
        action: type,
        ids,
        updatedBy,
        originTabId
    });
}
