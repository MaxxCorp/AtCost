// import Ably from 'ably'; // Removed for dynamic import
import {
    ABLY_API_KEY,
    VERCEL,
    CF_PAGES,
    ENABLE_REALTIME_POLLING,
    FORCE_ABLY
} from '$app/env/private';

import { EventEmitter } from 'events';

// Lazy initialization to avoid connecting if not configured or during build
let restClient: any = null; // using any to avoid type issues with dynamic import

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

export type EventChangeType = 'create' | 'update' | 'delete';

export interface EventChangeMessage {
    type: EventChangeType;
    ids: string[];
    timestamp: number;
    updatedBy?: {
        id: string;
        name?: string;
        email?: string;
    };
}

export interface EntityChangeMessage {
    entityType: string;
    id: string;
    action: EventChangeType;
    updatedBy?: {
        id: string;
        name?: string;
        email?: string;
    };
    timestamp: number;
    fields?: Record<string, any>;
}

export type RealtimeProviderType = 'sse' | 'ably' | 'polling' | 'none';

export interface RealtimeInfo {
    provider: RealtimeProviderType;
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
 * 1. Full/Permanent server is preferred for cost ($0 in-process SSE instead of cloud messaging fees).
 * 2. Serverless/Edge uses Ably if ABLY_API_KEY is configured.
 * 3. Polling requires explicit opt-in (ENABLE_REALTIME_POLLING=true) to prevent high serverless function costs.
 * 4. Otherwise, realtime is disabled with an explanatory reason.
 */
export function getRealtimeInfo(): RealtimeInfo {
    const isPermanent = !isServerlessEnvironment();
    const ablyConfigured = !!ABLY_API_KEY;
    const pollingEnabled = ENABLE_REALTIME_POLLING === 'true' || process.env.ENABLE_REALTIME_POLLING === 'true';

    // Priority 1: Full / Permanent server (Cost: $0 - uses built-in server memory & SSE)
    // Only use Ably on permanent server if FORCE_ABLY is explicitly set
    if (isPermanent && FORCE_ABLY !== 'true') {
        return {
            provider: 'sse',
            ablyConfigured,
            isPermanentServer: true,
            pollingEnabled
        };
    }

    // Priority 2: Serverless / Edge with Ably configured (or permanent server with FORCE_ABLY)
    if (ablyConfigured) {
        return {
            provider: 'ably',
            ablyConfigured: true,
            isPermanentServer: isPermanent,
            pollingEnabled
        };
    }

    // Priority 3: Polling ONLY if explicitly configured (to avoid serverless invocation costs)
    if (pollingEnabled) {
        return {
            provider: 'polling',
            ablyConfigured: false,
            isPermanentServer: isPermanent,
            pollingEnabled: true
        };
    }

    // Real-time collaboration unavailable
    return {
        provider: 'none',
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
 * Publish a change notification for a specific entity
 */
export async function publishEntityChange(
    entityType: string,
    id: string,
    change: {
        action: EventChangeType;
        updatedBy?: { id: string; name?: string; email?: string };
        fields?: Record<string, any>;
    }
) {
    const channelName = getEntityChannelName(entityType, id);
    const message: EntityChangeMessage = {
        entityType,
        id,
        action: change.action,
        updatedBy: change.updatedBy,
        fields: change.fields,
        timestamp: Date.now()
    };

    // 1. Broadcast to local hub for persistent server SSE clients
    localRealtimeHub.publish(channelName, message);

    // 2. Broadcast to Ably if available
    const client = await getClient();
    if (!client) {
        return;
    }

    try {
        await client.channels.get(channelName).publish('change', message);
    } catch (error) {
        console.error(`Failed to publish entity change to Ably channel ${channelName}:`, error);
    }
}

/**
 * Publish an event change notification
 */
export async function publishEventChange(
    type: EventChangeType,
    ids: string[],
    updatedBy?: { id: string; name?: string; email?: string }
) {
    const message: EventChangeMessage = {
        type,
        ids,
        updatedBy,
        timestamp: Date.now()
    };

    // 1. Broadcast to local hub
    localRealtimeHub.publish(CHANNELS.EVENT_CHANGES, message);
    for (const id of ids) {
        localRealtimeHub.publish(getEntityChannelName('event', id), {
            entityType: 'event',
            id,
            action: type,
            updatedBy,
            timestamp: message.timestamp
        });
    }

    // 2. Broadcast to Ably if configured
    const client = await getClient();
    if (!client) {
        return;
    }

    try {
        await client.channels.get(CHANNELS.EVENT_CHANGES).publish('change', message);

        await Promise.allSettled(
            ids.map((id) =>
                client.channels.get(getEntityChannelName('event', id)).publish('change', {
                    entityType: 'event',
                    id,
                    action: type,
                    updatedBy,
                    timestamp: message.timestamp
                })
            )
        );
    } catch (error) {
        console.error('Failed to publish event change to Ably:', error);
    }
}

/**
 * Publish an announcement change notification
 */
export async function publishAnnouncementChange(
    type: EventChangeType,
    ids: string[],
    updatedBy?: { id: string; name?: string; email?: string }
) {
    const message: EventChangeMessage = {
        type,
        ids,
        updatedBy,
        timestamp: Date.now()
    };

    // 1. Broadcast to local hub
    localRealtimeHub.publish(CHANNELS.ANNOUNCEMENT_CHANGES, message);
    for (const id of ids) {
        localRealtimeHub.publish(getEntityChannelName('announcement', id), {
            entityType: 'announcement',
            id,
            action: type,
            updatedBy,
            timestamp: message.timestamp
        });
    }

    // 2. Broadcast to Ably if configured
    const client = await getClient();
    if (!client) {
        return;
    }

    try {
        await client.channels.get(CHANNELS.ANNOUNCEMENT_CHANGES).publish('change', message);

        await Promise.allSettled(
            ids.map((id) =>
                client.channels.get(getEntityChannelName('announcement', id)).publish('change', {
                    entityType: 'announcement',
                    id,
                    action: type,
                    updatedBy,
                    timestamp: message.timestamp
                })
            )
        );
    } catch (error) {
        console.error('Failed to publish announcement change to Ably:', error);
    }
}
