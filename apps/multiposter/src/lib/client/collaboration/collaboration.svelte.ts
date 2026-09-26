import { browser } from '$app/environment';
import type * as AblyTypes from 'ably';
import { getCollaboratorColor } from './colors';
import type {
    Collaborator,
    CollaboratorPresenceData,
    EntityChangeMessage
} from './types';

// Singleton browser Ably client to reuse across channels and pages
let sharedRealtime: any = null;

async function getRealtimeClient(): Promise<any> {
    if (!browser) return null;
    if (!sharedRealtime) {
        try {
            const AblyModule = await import('ably');
            const Ably = AblyModule.default;
            sharedRealtime = new Ably.Realtime({
                authUrl: '/api/ably/auth',
                authMethod: 'GET',
                autoConnect: true
            });
        } catch (err) {
            console.error('[Collaboration] Failed to initialize Ably Realtime client:', err);
            return null;
        }
    }
    return sharedRealtime;
}

export interface UserSessionProfile {
    id: string;
    name?: string | null;
    email?: string | null;
    avatar?: string | null;
}

export interface CollaborationOptions {
    entityType: string;
    entityId: string;
    currentUser: UserSessionProfile;
    onRemoteChange?: (change: EntityChangeMessage) => void;
}

export class CollaborationRoom {
    private channelName: string;
    private entityType: string;
    private entityId: string;
    private currentUser: UserSessionProfile;
    private channel: any = null;
    private client: any = null;
    private changeCallbacks = new Set<(change: EntityChangeMessage) => void>();
    private isDestroyed = false;

    // Svelte 5 reactive state
    peers = $state<Collaborator[]>([]);
    connected = $state<boolean>(false);
    currentFocus = $state<string | null>(null);
    remoteChange = $state<EntityChangeMessage | null>(null);

    // Derived field-to-collaborator lookup for rapid styling
    fieldMap = $derived.by(() => {
        const map = new Map<string, Collaborator>();
        for (const peer of this.peers) {
            if (peer.focusedField && !map.has(peer.focusedField)) {
                map.set(peer.focusedField, peer);
            }
        }
        return map;
    });

    constructor(options: CollaborationOptions) {
        this.entityType = options.entityType;
        this.entityId = options.entityId;
        this.channelName = `entity:${this.entityType}:${this.entityId}`;
        this.currentUser = options.currentUser;

        if (options.onRemoteChange) {
            this.changeCallbacks.add(options.onRemoteChange);
        }

        if (browser && this.entityId) {
            this.init();
        }
    }

    private async init() {
        if (!browser || this.isDestroyed) return;

        this.client = await getRealtimeClient();
        if (!this.client || this.isDestroyed) return;

        this.channel = this.client.channels.get(this.channelName);

        // Track connection status
        this.connected = this.client.connection.state === 'connected';
        this.client.connection.on('connected', () => {
            this.connected = true;
        });
        this.client.connection.on('disconnected', () => {
            this.connected = false;
        });

        // 1. Subscribe to presence changes
        this.channel.presence.subscribe(['enter', 'leave', 'update', 'present'], async () => {
            await this.refreshPeers();
        });

        // 2. Enter presence with current user profile
        const userColor = getCollaboratorColor(this.currentUser.id);
        const presenceData: CollaboratorPresenceData = {
            userId: this.currentUser.id,
            name: this.currentUser.name || this.currentUser.email || 'Anonymous',
            email: this.currentUser.email || undefined,
            avatar: this.currentUser.avatar || undefined,
            color: userColor,
            focusedField: null,
            activeAt: Date.now()
        };

        try {
            await this.channel.presence.enter(presenceData);
            await this.refreshPeers();
        } catch (err) {
            console.error(`[Collaboration] Failed to enter presence on ${this.channelName}:`, err);
        }

        // 3. Subscribe to entity change broadcasts
        this.channel.subscribe('change', (message: any) => {
            const data = message.data as EntityChangeMessage;
            if (!data) return;

            // Ignore changes made by ourselves
            if (data.updatedBy?.id === this.currentUser.id) return;

            this.remoteChange = data;
            for (const cb of this.changeCallbacks) {
                try {
                    cb(data);
                } catch (e) {
                    console.error('[Collaboration] Error in onRemoteChange callback:', e);
                }
            }
        });
    }

    private async refreshPeers() {
        if (!this.channel || this.isDestroyed) return;
        try {
            const members = await this.channel.presence.get();
            const ownConnectionId = this.client?.connection?.id;

            this.peers = members
                .filter((m: any) => m.connectionId !== ownConnectionId)
                .map((m: any) => {
                    const data = m.data as CollaboratorPresenceData;
                    return {
                        clientId: m.clientId,
                        connectionId: m.connectionId,
                        userId: data?.userId || m.clientId,
                        name: data?.name || 'Anonymous',
                        email: data?.email,
                        avatar: data?.avatar,
                        color: data?.color || getCollaboratorColor(m.clientId),
                        focusedField: data?.focusedField ?? null,
                        activeAt: data?.activeAt ?? Date.now()
                    };
                });
        } catch (err) {
            console.warn('[Collaboration] Error fetching presence members:', err);
        }
    }

    /**
     * Broadcast which field the current user is focusing on
     */
    setFocus(fieldName: string | null) {
        if (this.currentFocus === fieldName || this.isDestroyed) return;
        this.currentFocus = fieldName;

        if (this.channel) {
            const userColor = getCollaboratorColor(this.currentUser.id);
            const presenceData: CollaboratorPresenceData = {
                userId: this.currentUser.id,
                name: this.currentUser.name || this.currentUser.email || 'Anonymous',
                email: this.currentUser.email || undefined,
                avatar: this.currentUser.avatar || undefined,
                color: userColor,
                focusedField: fieldName,
                activeAt: Date.now()
            };

            this.channel.presence.update(presenceData).catch((err: any) => {
                console.warn('[Collaboration] Failed to update presence focus:', err);
            });
        }
    }

    /**
     * Get the collaborator currently focused on a specific field
     */
    getFieldCollaborator(fieldName: string): Collaborator | undefined {
        return this.fieldMap.get(fieldName);
    }

    /**
     * Register a callback for remote entity updates
     */
    onRemoteChange(callback: (change: EntityChangeMessage) => void) {
        this.changeCallbacks.add(callback);
        return () => {
            this.changeCallbacks.delete(callback);
        };
    }

    /**
     * Clear the remote change notification banner
     */
    dismissRemoteChange() {
        this.remoteChange = null;
    }

    /**
     * Leave presence and cleanup channel subscriptions
     */
    destroy() {
        this.isDestroyed = true;
        this.changeCallbacks.clear();
        if (this.channel) {
            try {
                this.channel.presence.leave().catch(() => {});
                this.channel.unsubscribe();
            } catch (err) {
                console.warn('[Collaboration] Cleanup error:', err);
            }
        }
    }
}

/**
 * Helper to initialize a collaboration room
 */
export function createCollaborationRoom(options: CollaborationOptions): CollaborationRoom {
    return new CollaborationRoom(options);
}
