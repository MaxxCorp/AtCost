import { getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import {
	getRealtimeInfo,
	isValidRealtimeChannel,
	localRealtimeHub
} from '#lib/server/realtime.js';

export interface LiveChannelPacket<T = any> {
	seq: number;
	connectedAt: number;
	payload: T | null;
}

export function canStreamLiveQueries(): boolean {
	return getRealtimeInfo().supportsLiveQueries;
}

function getSafeRequestAbortSignal(): AbortSignal | undefined {
	try {
		return getRequestEvent()?.request?.signal;
	} catch {
		return undefined;
	}
}

/**
 * Reusable async-generator driver for SvelteKit `query.live(...)` endpoints.
 *
 * - On SSE-capable servers (`canStreamLiveQueries() === true`):
 *   Subscribes to `channels` on `localRealtimeHub` before running the initial
 *   `compute()`, streams updates until `request.signal` aborts, coalesces rapid
 *   bursts, and cleans up all listeners on disconnect.
 * - On serverless runtimes or when disabled:
 *   Yields the initial computed value once and immediately terminates (`done: true`)
 *   so SvelteKit cleanly closes the stream without holding serverless compute open.
 */
export async function* streamLiveQuery<T>(options: {
	channels: string[];
	compute: () => Promise<T> | T;
	coalesceMs?: number;
}): AsyncGenerator<T, void, void> {
	const signal = getSafeRequestAbortSignal();

	if (!canStreamLiveQueries() || signal?.aborted) {
		yield await options.compute();
		return;
	}

	const uniqueChannels = Array.from(new Set(options.channels.filter(Boolean)));
	let dirty = false;
	let notify: (() => void) | null = null;

	const wake = () => {
		if (notify) {
			const resolve = notify;
			notify = null;
			resolve();
		}
	};

	const onMessage = () => {
		dirty = true;
		wake();
	};

	const unsubscribers = uniqueChannels.map((ch) => localRealtimeHub.subscribe(ch, onMessage));
	const onAbort = () => wake();
	signal?.addEventListener('abort', onAbort, { once: true });

	const coalesceMs = options.coalesceMs ?? 40;

	try {
		dirty = false;
		yield await options.compute();

		while (!signal?.aborted) {
			if (!dirty) {
				await new Promise<void>((resolve) => {
					notify = resolve;
					if (dirty || signal?.aborted) {
						wake();
					}
				});
			}

			if (signal?.aborted) break;

			if (coalesceMs > 0) {
				await new Promise<void>((resolve) => {
					const timer = setTimeout(() => {
						signal?.removeEventListener('abort', earlyAbort);
						resolve();
					}, coalesceMs);
					const earlyAbort = () => {
						clearTimeout(timer);
						resolve();
					};
					signal?.addEventListener('abort', earlyAbort, { once: true });
				});
			}

			if (signal?.aborted) break;

			// Reset dirty BEFORE compute so mutations occurring during compute re-arm the loop
			dirty = false;
			const nextValue = await options.compute();
			if (!signal?.aborted) {
				yield nextValue;
			}
		}
	} finally {
		for (const unsub of unsubscribers) {
			unsub();
		}
		signal?.removeEventListener('abort', onAbort);
	}
}

/**
 * Reusable async-generator channel stream for SvelteKit `query.live(...)`.
 * Streams invalidation packets from `localRealtimeHub` for any validated channel.
 * Monotonically increasing `seq` ensures SvelteKit's `stringify` deduplication
 * never suppresses consecutive identical invalidation messages.
 */
export async function* streamLiveChannel<T = any>(
	channel: string
): AsyncGenerator<LiveChannelPacket<T>, void, void> {
	if (!isValidRealtimeChannel(channel)) {
		error(400, `Invalid realtime channel: ${channel}`);
	}

	const connectedAt = Date.now();
	let seq = 0;
	const signal = getSafeRequestAbortSignal();

	if (!canStreamLiveQueries() || signal?.aborted) {
		yield { seq: 0, connectedAt, payload: null };
		return;
	}

	const queue: T[] = [];
	let notify: (() => void) | null = null;

	const wake = () => {
		if (notify) {
			const resolve = notify;
			notify = null;
			resolve();
		}
	};

	const unsub = localRealtimeHub.subscribe(channel, (msg: T) => {
		queue.push(msg);
		wake();
	});
	const onAbort = () => wake();
	signal?.addEventListener('abort', onAbort, { once: true });

	try {
		yield { seq: 0, connectedAt, payload: null };

		while (!signal?.aborted) {
			if (queue.length === 0) {
				await new Promise<void>((resolve) => {
					notify = resolve;
					if (queue.length > 0 || signal?.aborted) {
						wake();
					}
				});
			}

			while (queue.length > 0 && !signal?.aborted) {
				const payload = queue.shift()!;
				yield { seq: ++seq, connectedAt, payload };
			}
		}
	} finally {
		unsub();
		signal?.removeEventListener('abort', onAbort);
	}
}
