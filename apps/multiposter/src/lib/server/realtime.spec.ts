import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$app/env/private', () => ({
	ABLY_API_KEY: '',
	VERCEL: '',
	CF_PAGES: '',
	ENABLE_REALTIME_POLLING: '',
	FORCE_ABLY: ''
}));

vi.mock('$app/server', () => ({
	getRequestEvent: () => ({
		request: new Request('http://localhost/events', {
			headers: { 'x-ac-tab-id': 'tab-header-1' }
		})
	})
}));

import {
	localRealtimeHub,
	publishEventChange,
	getRealtimeInfo,
	CHANNELS,
	getEntityChannelName,
	getEntityListChannelName
} from './realtime';

describe('realtime pub/sub channels', () => {
	let originalVercel: string | undefined;

	beforeEach(() => {
		vi.clearAllMocks();
		originalVercel = process.env.VERCEL;
		delete process.env.VERCEL;
	});

	afterEach(() => {
		if (originalVercel === undefined) {
			delete process.env.VERCEL;
		} else {
			process.env.VERCEL = originalVercel;
		}
	});

	it('advertises supportsLiveQueries=true on SSE-capable servers and false on serverless', () => {
		expect(getRealtimeInfo()).toMatchObject({
			provider: 'sse',
			supportsLiveQueries: true,
			isPermanentServer: true
		});

		process.env.VERCEL = '1';
		expect(getRealtimeInfo()).toMatchObject({
			provider: 'none',
			supportsLiveQueries: false,
			isPermanentServer: false
		});
	});

	it('publishes event changes to collection channels (entity-list:event & event-changes) and entity channels with originTabId', async () => {
		const listReceived: any[] = [];
		const legacyReceived: any[] = [];
		const entity1Received: any[] = [];
		const entity2Received: any[] = [];

		const unsubs = [
			localRealtimeHub.subscribe(getEntityListChannelName('event'), (msg) => listReceived.push(msg)),
			localRealtimeHub.subscribe(CHANNELS.EVENT_CHANGES, (msg) => legacyReceived.push(msg)),
			localRealtimeHub.subscribe(getEntityChannelName('event', 'evt-1'), (msg) => entity1Received.push(msg)),
			localRealtimeHub.subscribe(getEntityChannelName('event', 'evt-2'), (msg) => entity2Received.push(msg))
		];

		try {
			await publishEventChange('update', ['evt-1', 'evt-2', 'evt-1'], {
				id: 'user-1',
				name: 'Alice'
			});

			expect(listReceived).toHaveLength(1);
			expect(listReceived[0]).toMatchObject({
				type: 'update',
				action: 'update',
				entityType: 'event',
				ids: ['evt-1', 'evt-2'],
				eventIds: ['evt-1', 'evt-2'],
				originTabId: 'tab-header-1',
				updatedBy: { id: 'user-1', name: 'Alice' }
			});

			expect(legacyReceived).toHaveLength(1);
			expect(legacyReceived[0].ids).toEqual(['evt-1', 'evt-2']);

			expect(entity1Received).toHaveLength(1);
			expect(entity1Received[0]).toMatchObject({
				entityType: 'event',
				id: 'evt-1',
				action: 'update',
				originTabId: 'tab-header-1'
			});

			expect(entity2Received).toHaveLength(1);
			expect(entity2Received[0].id).toBe('evt-2');
		} finally {
			for (const u of unsubs) u();
		}
	});
});
