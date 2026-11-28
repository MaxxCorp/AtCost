import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { getMockSignal, setMockSignal } = vi.hoisted(() => {
	let signal: AbortSignal | undefined;
	return {
		getMockSignal: () => signal,
		setMockSignal: (next: AbortSignal | undefined) => {
			signal = next;
		}
	};
});

vi.mock('$app/env/private', () => ({
	ABLY_API_KEY: '',
	VERCEL: '',
	CF_PAGES: '',
	ENABLE_REALTIME_POLLING: '',
	FORCE_ABLY: ''
}));

vi.mock('$app/server', () => ({
	getRequestEvent: () => {
		const signal = getMockSignal();
		return signal ? { request: { signal } } : undefined;
	}
}));

import { localRealtimeHub } from './realtime';
import { streamLiveQuery, streamLiveChannel, canStreamLiveQueries } from './live-query';

describe('live-query driver', () => {
	let originalVercel: string | undefined;

	beforeEach(() => {
		vi.clearAllMocks();
		originalVercel = process.env.VERCEL;
		delete process.env.VERCEL;
		setMockSignal(undefined);
	});

	afterEach(() => {
		if (originalVercel === undefined) {
			delete process.env.VERCEL;
		} else {
			process.env.VERCEL = originalVercel;
		}
		setMockSignal(undefined);
	});

	it('streams initial compute and subsequent updates on SSE-capable server and cleans up on abort', async () => {
		const controller = new AbortController();
		setMockSignal(controller.signal);

		let counter = 0;
		const compute = vi.fn(async () => ({ version: ++counter }));
		const gen = streamLiveQuery({
			channels: ['entity-list:event', 'entity:event:evt-1'],
			compute,
			coalesceMs: 10
		});

		const first = await gen.next();
		expect(first).toEqual({ value: { version: 1 }, done: false });

		const nextPromise = gen.next();
		// Rapid burst of 2 messages should coalesce into a single recomputation
		localRealtimeHub.publish('entity:event:evt-1', { action: 'update' });
		localRealtimeHub.publish('entity-list:event', { action: 'update' });

		const second = await nextPromise;
		expect(second).toEqual({ value: { version: 2 }, done: false });
		expect(compute).toHaveBeenCalledTimes(2);

		// Aborting ends iteration cleanly and detaches listeners
		const endPromise = gen.next();
		controller.abort();
		const end = await endPromise;
		expect(end.done).toBe(true);

		// Subsequent publishes do not invoke compute after cleanup
		localRealtimeHub.publish('entity:event:evt-1', { action: 'update' });
		expect(compute).toHaveBeenCalledTimes(2);
	});

	it('falls back to single-shot initial yield on serverless runtimes (VERCEL=1)', async () => {
		process.env.VERCEL = '1';
		expect(canStreamLiveQueries()).toBe(false);

		const controller = new AbortController();
		setMockSignal(controller.signal);

		const gen = streamLiveQuery({
			channels: ['entity-list:event'],
			compute: async () => ({ count: 42 })
		});

		const first = await gen.next();
		expect(first).toEqual({ value: { count: 42 }, done: false });

		const second = await gen.next();
		expect(second.done).toBe(true);
	});

	it('streamLiveChannel yields handshake then monotonic seq packets and validates channel names', async () => {
		const controller = new AbortController();
		setMockSignal(controller.signal);

		const invalidGen = streamLiveChannel('invalid/channel!');
		await expect(invalidGen.next()).rejects.toThrow();

		const gen = streamLiveChannel('entity-list:event');
		const init = await gen.next();
		expect(init.done).toBe(false);
		expect(init.value?.seq).toBe(0);
		expect(init.value?.payload).toBeNull();

		const p1 = gen.next();
		localRealtimeHub.publish('entity-list:event', { action: 'update', ids: ['e-1'] });
		const firstMsg = await p1;
		expect(firstMsg.value?.seq).toBe(1);
		expect(firstMsg.value?.payload).toEqual({ action: 'update', ids: ['e-1'] });

		const p2 = gen.next();
		localRealtimeHub.publish('entity-list:event', { action: 'update', ids: ['e-1'] });
		const secondMsg = await p2;
		expect(secondMsg.value?.seq).toBe(2);
		expect(secondMsg.value?.payload).toEqual({ action: 'update', ids: ['e-1'] });

		controller.abort();
		const doneRes = await gen.next();
		expect(doneRes.done).toBe(true);
	});
});
