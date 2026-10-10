import { browser } from '$app/env';
import { getCollaboratorColor } from './colors';
import type {
    Collaborator,
    CollaboratorPresenceData,
    EntityChangeMessage
} from './types';

export type CollaborationProvider = 'sse' | 'ably' | 'polling' | 'none';

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

interface RealtimeCapability {
    provider: 'sse' | 'ably' | 'polling' | 'none';
    ablyConfigured: boolean;
    isPermanentServer: boolean;
    pollingEnabled: boolean;
    reason?: string;
}

// Singleton cached capability info to avoid redundant round-trips
let cachedCapabilityPromise: Promise<RealtimeCapability> | null = null;

async function getRealtimeCapability(): Promise<RealtimeCapability> {
    if (!browser) {
        return {
            provider: 'none',
            ablyConfigured: false,
            isPermanentServer: false,
            pollingEnabled: false,
            reason: 'Running in non-browser environment'
        };
    }
    if (!cachedCapabilityPromise) {
        cachedCapabilityPromise = (async () => {
            try {
                const res = await fetch('/api/realtime/info');
                if (res.ok) {
                    return await res.json() as RealtimeCapability;
                }
            } catch (err) {
                console.warn('[Collaboration] Capability check failed, defaulting to unavailable mode:', err);
            }
            return {
                provider: 'none',
                ablyConfigured: false,
                isPermanentServer: false,
                pollingEnabled: false,
                reason: 'Could not reach server capability endpoint'
            };
        })();
    }
    return cachedCapabilityPromise;
}

// Singleton browser Ably client
let sharedRealtime: any = null;

async function getAblyRealtimeClient(): Promise<any> {
    if (!browser) return null;
    if (!sharedRealtime) {
        try {
            const AblyModule = await import('ably');
            const Ably = AblyModule.default;
            sharedRealtime = new Ably.Realtime({
                authUrl: '/api/ably/auth',
                authMethod: 'GET',
                autoConnect: true,
                // Don't retry aggressively if auth or connection fails
                disconnectedRetryTimeout: 10000,
                suspendedRetryTimeout: 30000
            });
        } catch (err) {
            console.warn('[Collaboration] Failed to instantiate Ably Realtime:', err);
            return null;
        }
    }
    return sharedRealtime;
}

export class CollaborationRoom {
    private channelName: string;
    private entityType: string;
    private entityId: string;
    private currentUser: UserSessionProfile;
    private changeCallbacks = new Set<(change: EntityChangeMessage) => void>();
    private isDestroyed = false;

    // Active connection handles
    private ablyChannel: any = null;
    private ablyClient: any = null;
    private sseSource: EventSource | null = null;
    private sseConnectionId: string | null = null;
    private pollingInterval: ReturnType<typeof setInterval> | null = null;
    private visibilityHandler: (() => void) | null = null;

    // Svelte 5 reactive state
    peers = $state<Collaborator[]>([]);
    connected = $state<boolean>(false);
    provider = $state<CollaborationProvider>('none');
    currentFocus = $state<string | null>(null);
    remoteChange = $state<EntityChangeMessage | null>(null);
    offlineReason = $state<string | null>(null);

    // Derived field-to-collaborator lookup for UI bindings
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

        const capability = await getRealtimeCapability();
        if (this.isDestroyed) return;

        // Priority 1: Full permanent server preferred (Cost: $0 - uses built-in Node SSE)
        if (capability.provider === 'sse') {
            const success = this.initSSE();
            if (success) {
                this.offlineReason = null;
                return;
            }

            // Fallback: If permanent server SSE failed, try Ably if configured
            if (capability.ablyConfigured) {
                const ablySuccess = await this.initAbly();
                if (ablySuccess) {
                    this.offlineReason = null;
                    return;
                }
            }

            // Fallback: Polling only if explicitly enabled via environment variable
            if (capability.pollingEnabled) {
                this.initPolling();
                this.offlineReason = 'Direct server stream disconnected. Fallback polling active.';
                return;
            }

            this.provider = 'none';
            this.connected = false;
            this.offlineReason = 'Could not connect to the local real-time server stream.';
            return;
        }

        // Priority 2: Serverless / Edge with Ably
        if (capability.provider === 'ably') {
            const success = await this.initAbly();
            if (success) {
                this.offlineReason = null;
                return;
            }

            // Fallback: Polling only if explicitly enabled via environment variable
            if (capability.pollingEnabled) {
                this.initPolling();
                this.offlineReason = 'Ably connection failed. Fallback polling active.';
                return;
            }

            this.provider = 'none';
            this.connected = false;
            this.offlineReason = 'Could not connect to Ably real-time service (check network or API key).';
            return;
        }

        // Priority 3: Polling (only if explicitly enabled)
        if (capability.provider === 'polling') {
            this.initPolling();
            this.offlineReason = 'Running in polling mode (live WebSocket presence inactive).';
            return;
        }

        // Realtime is unavailable / disabled
        this.provider = 'none';
        this.connected = false;
        this.offlineReason =
            capability.reason ||
            'Real-time collaboration is disabled in this serverless environment (ABLY_API_KEY is not configured and ENABLE_REALTIME_POLLING is disabled).';
    }

    /**
     * Provider 1: Permanent Server In-Memory SSE
     */
    private initSSE(): boolean {
        if (!browser || typeof EventSource === 'undefined') return false;

        try {
            const userColor = encodeURIComponent(JSON.stringify(getCollaboratorColor(this.currentUser.id)));
            const sseUrl = `/api/realtime/sse?entityType=${encodeURIComponent(this.entityType)}&entityId=${encodeURIComponent(this.entityId)}&name=${encodeURIComponent(this.currentUser.name || '')}&color=${userColor}`;

            this.sseSource = new EventSource(sseUrl);
            this.provider = 'sse';

            this.sseSource.onopen = () => {
                if (!this.isDestroyed) {
                    this.connected = true;
                    this.offlineReason = null;
                }
            };

            this.sseSource.onerror = () => {
                if (!this.isDestroyed) {
                    this.connected = false;
                    this.offlineReason = 'Disconnected from real-time server stream. Reconnecting...';
                }
            };

            // Initial handshake
            this.sseSource.addEventListener('init', (e: MessageEvent) => {
                try {
                    const data = JSON.parse(e.data);
                    this.sseConnectionId = data.connectionId;
                    this.updateLocalPeers(data.members || []);
                } catch {}
            });

            // Presence updates
            this.sseSource.addEventListener('presence', (e: MessageEvent) => {
                try {
                    const data = JSON.parse(e.data);
                    if (data.members) {
                        this.updateLocalPeers(data.members);
                    }
                } catch {}
            });

            // Entity change events
            this.sseSource.addEventListener('change', (e: MessageEvent) => {
                try {
                    const data = JSON.parse(e.data) as EntityChangeMessage;
                    if (!data || data.updatedBy?.id === this.currentUser.id) return;
                    this.remoteChange = data;
                    this.notifyChangeCallbacks(data);
                } catch {}
            });

            return true;
        } catch (err) {
            console.warn('[Collaboration] SSE initialization failed:', err);
            this.cleanupSSE();
            return false;
        }
    }

    private updateLocalPeers(members: any[]) {
        this.peers = members
            .filter((m: any) => m.connectionId !== this.sseConnectionId)
            .map((m: any) => ({
                clientId: m.clientId,
                connectionId: m.connectionId,
                userId: m.userId || m.clientId,
                name: m.name || 'Anonymous',
                email: m.email,
                avatar: m.avatar,
                color: m.color || getCollaboratorColor(m.clientId),
                focusedField: m.focusedField ?? null,
                activeAt: m.activeAt ?? Date.now()
            }));
    }

    /**
     * Provider 2: Ably Realtime
     */
    private async initAbly(): Promise<boolean> {
        try {
            this.ablyClient = await getAblyRealtimeClient();
            if (!this.ablyClient) return false;

            this.ablyChannel = this.ablyClient.channels.get(this.channelName);

            // Handle connection states gracefully
            this.connected = this.ablyClient.connection.state === 'connected';
            this.provider = 'ably';

            this.ablyClient.connection.on('connected', () => {
                if (!this.isDestroyed) {
                    this.connected = true;
                    this.offlineReason = null;
                }
            });
            this.ablyClient.connection.on('disconnected', () => {
                if (!this.isDestroyed) {
                    this.connected = false;
                    this.offlineReason = 'Disconnected from Ably real-time service. Reconnecting...';
                }
            });
            this.ablyClient.connection.on('failed', (err: any) => {
                if (!this.isDestroyed) {
                    this.connected = false;
                    this.offlineReason = `Ably connection error: ${err?.reason?.message || 'Authentication or network failure'}`;
                    this.cleanupAbly();
                }
            });

            // Subscribe to presence
            this.ablyChannel.presence.subscribe(['enter', 'leave', 'update', 'present'], async () => {
                await this.refreshAblyPeers();
            });

            // Enter presence
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

            await this.ablyChannel.presence.enter(presenceData);
            await this.refreshAblyPeers();

            // Subscribe to entity updates
            this.ablyChannel.subscribe('change', (message: any) => {
                const data = message.data as EntityChangeMessage;
                if (!data) return;
                if (data.updatedBy?.id === this.currentUser.id) return;

                this.remoteChange = data;
                this.notifyChangeCallbacks(data);
            });

            return true;
        } catch (err) {
            console.warn('[Collaboration] Ably setup failed:', err);
            this.cleanupAbly();
            return false;
        }
    }

    private async refreshAblyPeers() {
        if (!this.ablyChannel || this.isDestroyed) return;
        try {
            const members = await this.ablyChannel.presence.get();
            const ownConnectionId = this.ablyClient?.connection?.id;

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
            console.warn('[Collaboration] Error refreshing Ably peers:', err);
        }
    }

    /**
     * Provider 3: Polling Mode (Only run if explicitly enabled via ENABLE_REALTIME_POLLING)
     */
    private initPolling() {
        this.provider = 'polling';
        this.connected = false;
        this.peers = [];

        // Tab focus sync: when user switches back to this tab, check for changes
        this.visibilityHandler = () => {
            if (document.visibilityState === 'visible' && !this.isDestroyed) {
                this.notifyChangeCallbacks({
                    entityType: this.entityType,
                    id: this.entityId,
                    action: 'update',
                    timestamp: Date.now()
                });
            }
        };
        document.addEventListener('visibilitychange', this.visibilityHandler);

        // Periodic 30s background sync while tab is active
        this.pollingInterval = setInterval(() => {
            if (document.visibilityState === 'visible' && !this.isDestroyed) {
                this.notifyChangeCallbacks({
                    entityType: this.entityType,
                    id: this.entityId,
                    action: 'update',
                    timestamp: Date.now()
                });
            }
        }, 30000);
    }

    private notifyChangeCallbacks(message: EntityChangeMessage) {
        for (const cb of this.changeCallbacks) {
            try {
                cb(message);
            } catch (e) {
                console.error('[Collaboration] Error in onRemoteChange callback:', e);
            }
        }
    }

    /**
     * Broadcast which field the current user is focusing on
     */
    setFocus(fieldName: string | null) {
        if (this.currentFocus === fieldName || this.isDestroyed || !this.connected) return;
        this.currentFocus = fieldName;

        if (this.provider === 'sse' && this.sseConnectionId) {
            fetch('/api/realtime/presence', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entityType: this.entityType,
                    entityId: this.entityId,
                    connectionId: this.sseConnectionId,
                    focusedField: fieldName
                })
            }).catch(() => {});
        } else if (this.provider === 'ably' && this.ablyChannel) {
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

            this.ablyChannel.presence.update(presenceData).catch(() => {});
        }
    }

    getFieldCollaborator(fieldName: string): Collaborator | undefined {
        return this.fieldMap.get(fieldName);
    }

    onRemoteChange(callback: (change: EntityChangeMessage) => void) {
        this.changeCallbacks.add(callback);
        return () => {
            this.changeCallbacks.delete(callback);
        };
    }

    dismissRemoteChange() {
        this.remoteChange = null;
    }

    private cleanupAbly() {
        if (this.ablyChannel) {
            try {
                this.ablyChannel.presence.leave().catch(() => {});
                this.ablyChannel.unsubscribe();
            } catch {}
            this.ablyChannel = null;
        }
    }

    private cleanupSSE() {
        if (this.sseSource) {
            try {
                this.sseSource.close();
            } catch {}
            this.sseSource = null;
        }
        this.sseConnectionId = null;
    }

    private cleanupPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        if (this.visibilityHandler) {
            document.removeEventListener('visibilitychange', this.visibilityHandler);
            this.visibilityHandler = null;
        }
    }

    destroy() {
        this.isDestroyed = true;
        this.changeCallbacks.clear();
        this.cleanupAbly();
        this.cleanupSSE();
        this.cleanupPolling();
    }
}

export function createCollaborationRoom(options: CollaborationOptions): CollaborationRoom {
    return new CollaborationRoom(options);
}
