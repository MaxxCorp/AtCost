import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
	callOrder,
	mockInvalidateEvent,
	mockPublishEventChange,
	mockListEventsFn,
	mockListEventsLiveFn,
	mockReadEventFn,
	mockReadEventLiveFn,
	mockRequested,
	mockLocalPublish
} = vi.hoisted(() => {
	const callOrder: string[] = [];
	const mockInvalidateEvent = vi.fn(async (ids?: string | string[]) => {
		callOrder.push(`invalidate:${Array.isArray(ids) ? ids.join(',') : ids ?? ''}`);
	});
	const mockPublishEventChange = vi.fn(async (type: string, ids: string[]) => {
		callOrder.push(`publish:${type}:${ids.join(',')}`);
	});
	const mockListEventsFn: any = Object.assign(
		vi.fn(() => ({ refresh: vi.fn() })),
		{}
	);
	const mockListEventsLiveFn: any = Object.assign(
		vi.fn(() => ({ reconnect: vi.fn() })),
		{}
	);
	const mockReadEventFn: any = Object.assign(
		vi.fn(() => ({ refresh: vi.fn() })),
		{}
	);
	const mockReadEventLiveFn: any = Object.assign(
		vi.fn(() => ({ reconnect: vi.fn() })),
		{}
	);
	const mockRequested = vi.fn<(...args: any[]) => any>(() => {
		throw new Error('Cannot call requested outside remote function');
	});
	const mockLocalPublish = vi.fn();

	return {
		callOrder,
		mockInvalidateEvent,
		mockPublishEventChange,
		mockListEventsFn,
		mockListEventsLiveFn,
		mockReadEventFn,
		mockReadEventLiveFn,
		mockRequested,
		mockLocalPublish
	};
});

vi.mock('$app/server', () => ({
	requested: mockRequested,
	getRequestEvent: vi.fn(() => {
		throw new Error('No request event');
	})
}));

vi.mock('#lib/server/cache/index.js', () => ({
	invalidateEvent: mockInvalidateEvent
}));

vi.mock('#lib/server/realtime.js', async () => {
	return {
		publishEventChange: mockPublishEventChange
	};
});

vi.mock('../../../routes/events/list.remote.js', () => ({
	listEvents: mockListEventsFn,
	listEventsLive: mockListEventsLiveFn
}));

vi.mock('../../../routes/events/[id]/read.remote.js', () => ({
	readEvent: mockReadEventFn,
	readEventLive: mockReadEventLiveFn
}));

import { commitEventChange, expandAffectedEventIds } from './sync-commit';

describe('expandAffectedEventIds', () => {
	it('expands virtual instance IDs to include their series master ID and deduplicates', () => {
		const masterId = '11111111-1111-1111-1111-111111111111';
		const virtualId = `${masterId}_inst_2026-05-01T10:00:00.000Z`;
		const result = expandAffectedEventIds(
			[virtualId, null, undefined, '', virtualId],
			[masterId, '22222222-2222-2222-2222-222222222222']
		);

		expect(result).toEqual([
			virtualId,
			masterId,
			'22222222-2222-2222-2222-222222222222'
		]);
	});
});

describe('commitEventChange', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		callOrder.length = 0;
	});

	it('strictly invalidates Redis caches BEFORE publishing realtime change notifications', async () => {
		const masterId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
		const virtualId = `${masterId}_inst_2026-06-10T18:00:00.000Z`;

		const affected = await commitEventChange({
			action: 'update',
			ids: [virtualId],
			user: { id: 'user-1', name: 'Alice' },
			originTabId: 'tab-abc'
		});

		expect(affected).toEqual([virtualId, masterId]);
		expect(callOrder).toEqual([
			`invalidate:${virtualId},${masterId}`,
			`publish:update:${virtualId},${masterId}`
		]);
		expect(mockInvalidateEvent).toHaveBeenCalledTimes(1);
		expect(mockPublishEventChange).toHaveBeenCalledWith(
			'update',
			[virtualId, masterId],
			{ id: 'user-1', name: 'Alice', email: undefined },
			'tab-abc'
		);
	});

	it('handles calls outside SvelteKit remote function context safely and runs extraRefresh', async () => {
		const extraRefresh = vi.fn(async () => {
			callOrder.push('extraRefresh');
		});

		await commitEventChange({
			action: 'delete',
			ids: ['event-1'],
			extraRefresh
		});

		expect(extraRefresh).toHaveBeenCalledTimes(1);
		expect(callOrder).toEqual([
			'invalidate:event-1',
			'extraRefresh',
			'publish:delete:event-1'
		]);
	});

	it('skips realtime broadcast when affected IDs list is empty while still invalidating namespace', async () => {
		const affected = await commitEventChange({
			action: 'update',
			ids: []
		});

		expect(affected).toEqual([]);
		expect(mockInvalidateEvent).toHaveBeenCalledWith([]);
		expect(mockPublishEventChange).not.toHaveBeenCalled();
	});

	it('triggers refreshAll for query handles and reconnectAll for query.live handles inside remote context', async () => {
		const refreshAll = vi.fn(async () => {});
		const reconnectAll = vi.fn(async () => {});

		mockRequested.mockImplementation((fn: any) => {
			if (fn === mockListEventsFn || fn === mockReadEventFn) {
				return { refreshAll } as any;
			}
			if (fn === mockListEventsLiveFn || fn === mockReadEventLiveFn) {
				return { reconnectAll } as any;
			}
			throw new Error('Unexpected remote handle');
		});

		await commitEventChange({
			action: 'update',
			ids: ['evt-live-1']
		});

		expect(refreshAll).toHaveBeenCalledTimes(2);
		expect(reconnectAll).toHaveBeenCalledTimes(2);
		expect(mockReadEventFn).toHaveBeenCalledWith('evt-live-1');
		expect(mockReadEventLiveFn).toHaveBeenCalledWith('evt-live-1');
	});
});
