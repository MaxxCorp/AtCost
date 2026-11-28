import { browser } from '$app/env';
import type { Attachment } from 'svelte/attachments';
import {
	attachRealtimeRefresh,
	getTabClientId,
	isOwnRecentMutation
} from '@ac/ui';
import { getRealtimeConfig, watchRealtimeChannel } from '../../../routes/realtime.remote.js';

export interface RealtimeCapability {
	provider: 'sse' | 'ably' | 'polling' | 'none';
	supportsLiveQueries: boolean;
	ablyConfigured: boolean;
	isPermanentServer: boolean;
	pollingEnabled: boolean;
	reason?: string;
}

const CAPABILITY_STORAGE_KEY = 'ac_realtime_capability_v1';

function normalizeCapability(raw: any): RealtimeCapability {
	const provider: RealtimeCapability['provider'] =
		raw?.provider === 'sse' ||
		raw?.provider === 'ably' ||
		raw?.provider === 'polling' ||
		raw?.provider === 'none'
			? raw.provider
			: 'none';
	const isPermanentServer = Boolean(raw?.isPermanentServer);
	return {
		provider,
		supportsLiveQueries:
			typeof raw?.supportsLiveQueries === 'boolean'
				? raw.supportsLiveQueries
				: provider === 'sse' && isPermanentServer,
		ablyConfigured: Boolean(raw?.ablyConfigured),
		isPermanentServer,
		pollingEnabled: Boolean(raw?.pollingEnabled),
		...(typeof raw?.reason === 'string' ? { reason: raw.reason } : {})
	};
}

function readCachedCapability(): RealtimeCapability | null {
	if (!browser || typeof sessionStorage === 'undefined') return null;
	try {
		const raw = sessionStorage.getItem(CAPABILITY_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (
			parsed &&
			(parsed.provider === 'sse' ||
				parsed.provider === 'ably' ||
				parsed.provider === 'polling' ||
				parsed.provider === 'none') &&
			typeof parsed.supportsLiveQueries === 'boolean'
		) {
			return normalizeCapability(parsed);
		}
	} catch {
		// ignore sessionStorage read issues
	}
	return null;
}

function writeCachedCapability(cap: RealtimeCapability) {
	if (!browser || typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.setItem(CAPABILITY_STORAGE_KEY, JSON.stringify(cap));
	} catch {
		// ignore storage quota errors
	}
}

let capabilityState = $state<RealtimeCapability | null>(readCachedCapability());
let capabilityReady = $state<boolean>(capabilityState !== null);
let cachedCapabilityPromise: Promise<RealtimeCapability> | null = null;
let sharedAblyPromise: Promise<any> | null = null;
let sharedAblyInstance: any = null;
let sharedAblyConnectionMonitorAttached = false;
let hasSeenConnectedState = false;
let wasDisconnectedOrSuspended = false;

const reconnectListeners = new Set<() => void>();

export async function getRealtimeCapability(): Promise<RealtimeCapability> {
	if (!browser) {
		return {
			provider: 'none',
			supportsLiveQueries: false,
			ablyConfigured: false,
			isPermanentServer: false,
			pollingEnabled: false,
			reason: 'Running in non-browser environment'
		};
	}

	if (!cachedCapabilityPromise) {
		cachedCapabilityPromise = (async () => {
			try {
				const remoteInfo = await getRealtimeConfig();
				if (remoteInfo) {
					const normalized = normalizeCapability(remoteInfo);
					capabilityState = normalized;
					capabilityReady = true;
					writeCachedCapability(normalized);
					return normalized;
				}
			} catch (err) {
				console.warn('[Realtime] Remote capability query failed, falling back to /api/realtime/info:', err);
			}

			try {
				const res = await fetch('/api/realtime/info');
				if (res.ok) {
					const normalized = normalizeCapability(await res.json());
					capabilityState = normalized;
					capabilityReady = true;
					writeCachedCapability(normalized);
					return normalized;
				}
			} catch (err) {
				console.warn('[Realtime] Capability check failed:', err);
			}

			const fallback: RealtimeCapability = capabilityState ?? {
				provider: 'none',
				supportsLiveQueries: false,
				ablyConfigured: false,
				isPermanentServer: false,
				pollingEnabled: false,
				reason: 'Could not reach server capability endpoint'
			};
			capabilityState = fallback;
			capabilityReady = true;
			return fallback;
		})();
	}

	return cachedCapabilityPromise;
}

export const ensureRealtimeCapability = getRealtimeCapability;

/**
 * Reactive check indicating whether realtime capabilities for this runtime have been determined.
 * Warm tabs resolve synchronously from sessionStorage; cold tabs resolve once in ~5ms.
 */
export function isRealtimeCapabilityReady(): boolean {
	if (!browser) return false;
	if (!capabilityReady) {
		void getRealtimeCapability();
	}
	return capabilityReady;
}

/**
 * Reactive check returning `true` when running on an SSE-capable server where SvelteKit's
 * built-in `query.live` path is supported and preferred over paid Ably / polling.
 */
export function preferLiveQuery(): boolean {
	if (!browser) return false;
	if (!capabilityReady) {
		void getRealtimeCapability();
	}
	return Boolean(capabilityState?.supportsLiveQueries);
}

/**
 * Uniformly refresh either a standard `RemoteQuery` (`.refresh()`) or
 * trigger reconnect on a `RemoteLiveQuery` (`.reconnect()`).
 */
export async function refreshRemoteResource(
	resource:
		| {
				refresh?: () => Promise<void>;
				reconnect?: () => Promise<void>;
		  }
		| null
		| undefined
): Promise<void> {
	if (!resource) return;
	if (typeof resource.refresh === 'function') {
		await resource.refresh();
	} else if (typeof resource.reconnect === 'function') {
		await resource.reconnect();
	}
}

/**
 * Shared singleton Ably Realtime connection per browser tab.
 * Includes `tabId` in the token auth request so multi-tab sessions for the
 * same user receive distinct clientIds and receive updates across tabs.
 */
export async function getSharedAblyClient(): Promise<any> {
	if (!browser) return null;
	if (sharedAblyInstance) return sharedAblyInstance;

	if (!sharedAblyPromise) {
		sharedAblyPromise = (async () => {
			try {
				const AblyModule = await import('ably');
				const Ably = AblyModule.default;
				const tabId = getTabClientId();
				const client = new Ably.Realtime({
					authUrl: `/api/ably/auth?tabId=${encodeURIComponent(tabId)}`,
					authMethod: 'GET',
					autoConnect: true,
					disconnectedRetryTimeout: 10000,
					suspendedRetryTimeout: 30000
				});

				if (!sharedAblyConnectionMonitorAttached) {
					sharedAblyConnectionMonitorAttached = true;
					client.connection.on('connected', () => {
						if (hasSeenConnectedState && wasDisconnectedOrSuspended) {
							wasDisconnectedOrSuspended = false;
							for (const cb of reconnectListeners) {
								try {
									cb();
								} catch (err) {
									console.warn('[Realtime] Reconnect listener error:', err);
								}
							}
						}
						hasSeenConnectedState = true;
					});
					client.connection.on('disconnected', () => {
						if (hasSeenConnectedState) wasDisconnectedOrSuspended = true;
					});
					client.connection.on('suspended', () => {
						if (hasSeenConnectedState) wasDisconnectedOrSuspended = true;
					});
					client.connection.on('closed', () => {
						sharedAblyInstance = null;
						sharedAblyPromise = null;
					});
				}

				sharedAblyInstance = client;
				return client;
			} catch (err) {
				console.warn('[Realtime] Failed to initialize Ably Realtime client:', err);
				sharedAblyPromise = null;
				return null;
			}
		})();
	}

	return sharedAblyPromise;
}

function subscribeViaEventSource(
	channelName: string,
	onMessage: (payload: any) => void,
	onReconnect?: () => void
): () => void {
	let sseConnectedOnce = false;
	const sseUrl = `/api/realtime/sse?channel=${encodeURIComponent(channelName)}`;
	const source = new EventSource(sseUrl);

	source.onopen = () => {
		if (sseConnectedOnce) {
			onReconnect?.();
		}
		sseConnectedOnce = true;
	};

	const changeListener = (e: MessageEvent) => {
		try {
			const parsed = JSON.parse(e.data);
			onMessage(parsed);
		} catch {
			// ignore malformed SSE packet
		}
	};
	source.addEventListener('change', changeListener);

	return () => {
		source.removeEventListener('change', changeListener);
		source.close();
	};
}

/**
 * Reference-counted channel subscription preferring SvelteKit's built-in `query.live`
 * on SSE-capable platforms (zero Ably cost), with fallback to `EventSource` or Ably (serverless).
 */
export function subscribeRealtimeChannel(
	channelName: string,
	onMessage: (payload: any) => void,
	onReconnect?: () => void
): () => void {
	if (!browser || !channelName) return () => {};

	let disposed = false;
	let cleanupTransport: (() => void) | null = null;
	if (onReconnect) {
		reconnectListeners.add(onReconnect);
	}

	const start = async () => {
		const capability = await getRealtimeCapability();
		if (disposed) return;

		if (capability.supportsLiveQueries) {
			const liveQuery = watchRealtimeChannel(channelName);
			const iter = liveQuery[Symbol.asyncIterator]();
			let iterClosed = false;

			cleanupTransport = () => {
				if (!iterClosed) {
					iterClosed = true;
					void iter.return?.();
				}
			};

			let seenFirstPacket = false;
			let activeConnectionTs: number | null = null;

			try {
				while (!disposed) {
					const { value: packet, done } = await iter.next();
					if (done || disposed || !packet) break;

					if (!seenFirstPacket) {
						seenFirstPacket = true;
						activeConnectionTs = packet.connectedAt;
						continue;
					}

					if (packet.seq === 0) {
						if (activeConnectionTs !== null && packet.connectedAt !== activeConnectionTs) {
							activeConnectionTs = packet.connectedAt;
							onReconnect?.();
						}
						continue;
					}

					activeConnectionTs = packet.connectedAt;
					if (packet.payload !== null && packet.payload !== undefined) {
						onMessage(packet.payload);
					}
				}
				return;
			} catch (err) {
				if (disposed) return;
				console.warn(`[Realtime] query.live channel ${channelName} failed, falling back:`, err);
				if (typeof EventSource !== 'undefined') {
					cleanupTransport = subscribeViaEventSource(channelName, onMessage, onReconnect);
				}
				return;
			}
		}

		if (capability.provider === 'sse' && typeof EventSource !== 'undefined') {
			cleanupTransport = subscribeViaEventSource(channelName, onMessage, onReconnect);
			return;
		}

		if (capability.provider === 'ably') {
			const client = await getSharedAblyClient();
			if (disposed || !client) return;

			const channel = client.channels.get(channelName);
			const listener = (message: any) => {
				onMessage(message?.data ?? message);
			};
			channel.subscribe('change', listener);

			cleanupTransport = () => {
				try {
					channel.unsubscribe('change', listener);
				} catch {
					// ignore cleanup errors
				}
			};
			return;
		}

		if (capability.pollingEnabled) {
			const timer = setInterval(() => {
				if (typeof document === 'undefined' || document.visibilityState === 'visible') {
					onReconnect?.();
				}
			}, 30_000);
			cleanupTransport = () => clearInterval(timer);
		}
	};

	void start();

	return () => {
		disposed = true;
		if (onReconnect) {
			reconnectListeners.delete(onReconnect);
		}
		if (cleanupTransport) {
			cleanupTransport();
			cleanupTransport = null;
		}
	};
}

export interface RealtimeSyncOptions {
	/**
	 * Skip opening a separate channel stream when `query.live` is supported
	 * (used by views that already consume a direct `query.live` data stream).
	 */
	skipWhenLiveQuerySupported?: boolean;
}

/**
 * Svelte 5 `{@attach}` helper for any entity list/collection page.
 * Subscribes to `entity-list:<entityType>`, suppresses echoes from this tab's own mutations,
 * and triggers `onRefresh` for changes made by other users, other tabs, or external webhooks.
 */
export function realtimeCollectionSync<TPayload = any>(
	entityType: string,
	onRefresh: (payload?: TPayload) => void | Promise<void>,
	options?: RealtimeSyncOptions
): Attachment<HTMLElement> {
	const channelName = `entity-list:${entityType}`;
	return attachRealtimeRefresh<TPayload>({
		subscribe: (onEvent, onReconnect) => {
			let unsub: (() => void) | null = null;
			let disposed = false;

			void getRealtimeCapability().then((cap) => {
				if (disposed) return;
				if (options?.skipWhenLiveQuerySupported && cap.supportsLiveQueries) {
					return;
				}
				unsub = subscribeRealtimeChannel(
					channelName,
					(payload) => {
						if (isOwnRecentMutation(channelName, payload?.originTabId)) {
							return;
						}
						onEvent(payload);
					},
					onReconnect
				);
			});

			return () => {
				disposed = true;
				unsub?.();
				unsub = null;
			};
		},
		onRefresh
	});
}

/**
 * Svelte 5 `{@attach}` helper for any entity detail/read-only view page.
 * Reads `getEntityId()` inside the attachment so route transitions between items
 * automatically re-subscribe without `$effect` boilerplate.
 */
export function realtimeEntitySync<TPayload = any>(
	entityType: string,
	getEntityId: () => string,
	onRefresh: (payload?: TPayload) => void | Promise<void>,
	options?: RealtimeSyncOptions
): Attachment<HTMLElement> {
	const baseAttachment = (node: HTMLElement) => {
		const entityId = getEntityId();
		if (!entityId) return;

		const entityChannel = `entity:${entityType}:${entityId}`;
		const instIdx = entityId.indexOf('_inst_');
		const masterChannel = instIdx > 0 ? `entity:${entityType}:${entityId.slice(0, instIdx)}` : null;

		const attachment = attachRealtimeRefresh<TPayload>({
			subscribe: (onEvent, onReconnect) => {
				let unsubEntity: (() => void) | null = null;
				let unsubMaster: (() => void) | null = null;
				let disposed = false;

				void getRealtimeCapability().then((cap) => {
					if (disposed) return;
					if (options?.skipWhenLiveQuerySupported && cap.supportsLiveQueries) {
						return;
					}
					const handlePayload = (payload: any) => {
						if (isOwnRecentMutation(entityChannel, payload?.originTabId)) {
							return;
						}
						onEvent(payload);
					};
					unsubEntity = subscribeRealtimeChannel(entityChannel, handlePayload, onReconnect);
					unsubMaster = masterChannel
						? subscribeRealtimeChannel(masterChannel, handlePayload)
						: null;
				});

				return () => {
					disposed = true;
					unsubEntity?.();
					unsubMaster?.();
					unsubEntity = null;
					unsubMaster = null;
				};
			},
			onRefresh
		});

		return attachment(node);
	};

	return baseAttachment;
}
