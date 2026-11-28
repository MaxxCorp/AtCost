import type { Attachment } from 'svelte/attachments';

const TAB_CLIENT_ID: string =
	typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
		? crypto.randomUUID()
		: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const localMutationTimestamps = new Map<string, number>();

/**
 * Unique identifier for the current browser tab/instance.
 * Allows filtering echoes from this tab while still updating other tabs of the same user.
 */
export function getTabClientId(): string {
	return TAB_CLIENT_ID;
}

/**
 * Record that the current tab just performed a mutation for an entity type and/or specific IDs.
 * Call right before firing a form submit or remote command mutation.
 */
export function markLocalEntityMutation(
	entityType: string,
	ids?: Iterable<string | null | undefined>
): void {
	const now = Date.now();
	localMutationTimestamps.set(`entity-list:${entityType}`, now);
	if (!ids) return;
	for (const rawId of ids) {
		if (!rawId) continue;
		localMutationTimestamps.set(`entity:${entityType}:${rawId}`, now);
		const instIdx = rawId.indexOf('_inst_');
		if (instIdx > 0) {
			localMutationTimestamps.set(`entity:${entityType}:${rawId.slice(0, instIdx)}`, now);
		}
	}
}

/**
 * Check whether an incoming realtime message originated from THIS browser tab.
 * Other open tabs/devices of the same user return `false` so they still refresh.
 */
export function isOwnRecentMutation(
	channelKey: string,
	originTabId?: string,
	windowMs = 1500
): boolean {
	if (originTabId) {
		return originTabId === TAB_CLIENT_ID;
	}
	const lastTs = localMutationTimestamps.get(channelKey);
	return typeof lastTs === 'number' && Date.now() - lastTs < windowMs;
}

export interface RealtimeRefreshAttachmentOptions<TPayload = any> {
	subscribe: (
		onEvent: (payload: TPayload) => void,
		onReconnect?: () => void
	) => () => void;
	onRefresh: (payload?: TPayload) => void | Promise<void>;
	/**
	 * Refresh automatically if the tab returns from background after at least this duration (ms).
	 * Defaults to 30,000ms (30s). Set to 0 to disable visibility refresh.
	 */
	refreshOnVisibleAfterMs?: number;
	/**
	 * Debounce window for burst realtime events (ms). Defaults to 150ms.
	 */
	debounceMs?: number;
}

/**
 * Generic Svelte 5 `{@attach}` helper that keeps views and RemoteQueries synchronized
 * over an app's realtime transport, plus reconnect & wake-from-sleep recovery.
 */
export function attachRealtimeRefresh<TPayload = any>(
	options: RealtimeRefreshAttachmentOptions<TPayload>
): Attachment<HTMLElement> {
	const debounceMs = options.debounceMs ?? 150;
	const visibleThresholdMs = options.refreshOnVisibleAfterMs ?? 30_000;

	return () => {
		let destroyed = false;
		let debounceTimer: ReturnType<typeof setTimeout> | null = null;
		let hiddenAt: number | null =
			typeof document !== 'undefined' && document.visibilityState === 'hidden' ? Date.now() : null;

		const triggerRefresh = (payload?: TPayload) => {
			if (destroyed) return;
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				debounceTimer = null;
				if (!destroyed) {
					void Promise.resolve(options.onRefresh(payload)).catch((err) => {
						console.warn('[RealtimeSync] Refresh callback failed:', err);
					});
				}
			}, debounceMs);
		};

		const unsubscribe = options.subscribe(
			(payload) => triggerRefresh(payload),
			() => triggerRefresh()
		);

		const onVisibilityChange = () => {
			if (typeof document === 'undefined' || visibleThresholdMs <= 0) return;
			if (document.visibilityState === 'hidden') {
				hiddenAt = Date.now();
			} else if (document.visibilityState === 'visible') {
				const hiddenDuration = hiddenAt !== null ? Date.now() - hiddenAt : 0;
				hiddenAt = null;
				if (hiddenDuration >= visibleThresholdMs) {
					triggerRefresh();
				}
			}
		};

		const onOnline = () => {
			triggerRefresh();
		};

		if (typeof document !== 'undefined') {
			document.addEventListener('visibilitychange', onVisibilityChange);
		}
		if (typeof window !== 'undefined') {
			window.addEventListener('online', onOnline);
		}

		return () => {
			destroyed = true;
			if (debounceTimer) {
				clearTimeout(debounceTimer);
				debounceTimer = null;
			}
			unsubscribe();
			if (typeof document !== 'undefined') {
				document.removeEventListener('visibilitychange', onVisibilityChange);
			}
			if (typeof window !== 'undefined') {
				window.removeEventListener('online', onOnline);
			}
		};
	};
}
