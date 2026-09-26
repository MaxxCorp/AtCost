// import Ably from 'ably'; // Removed for dynamic import
import { env } from '$env/dynamic/private';

// Lazy initialization to avoid connecting if not configured or during build
let restClient: any = null; // using any to avoid type issues with dynamic import

export async function getClient() {
    if (!restClient && env.ABLY_API_KEY) {
        try {
            // @ts-ignore
            const Ably = (await import('ably')).default;
            restClient = new Ably.Rest(env.ABLY_API_KEY);
        } catch (e) {
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
    const client = await getClient();
    if (!client) {
        if (!env.ABLY_API_KEY) console.warn('ABLY_API_KEY not set, realtime features disabled');
        return;
    }

    const channelName = getEntityChannelName(entityType, id);
    const message: EntityChangeMessage = {
        entityType,
        id,
        action: change.action,
        updatedBy: change.updatedBy,
        fields: change.fields,
        timestamp: Date.now()
    };

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
    const client = await getClient();
    if (!client) {
        if (!env.ABLY_API_KEY) console.warn('ABLY_API_KEY not set, realtime features disabled');
        return;
    }

    const message: EventChangeMessage = {
        type,
        ids,
        updatedBy,
        timestamp: Date.now()
    };

    try {
        // Broadcast to general event-changes channel (for kiosks, lists)
        await client.channels.get(CHANNELS.EVENT_CHANGES).publish('change', message);

        // Also publish to each individual entity channel for fine-grained presence/collaboration
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
    const client = await getClient();
    if (!client) {
        if (!env.ABLY_API_KEY) console.warn('ABLY_API_KEY not set, realtime features disabled');
        return;
    }

    const message: EventChangeMessage = {
        type,
        ids,
        updatedBy,
        timestamp: Date.now()
    };

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
