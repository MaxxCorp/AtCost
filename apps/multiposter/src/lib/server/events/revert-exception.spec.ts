import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
	mockDb,
	selectResults,
	mockStorageDelete,
	mockDeleteEventMappings,
	mockSyncItems,
	mockPublishEventChange,
	mockInvalidateEvent,
	mockRestoreInventoryForEvents
} = vi.hoisted(() => {
	const selectResults: any[][] = [];
	const mockStorageDelete = vi.fn().mockResolvedValue(undefined);
	const mockDeleteEventMappings = vi.fn().mockResolvedValue(undefined);
	const mockSyncItems = vi.fn().mockResolvedValue(undefined);
	const mockPublishEventChange = vi.fn().mockResolvedValue(undefined);
	const mockInvalidateEvent = vi.fn().mockResolvedValue(undefined);
	const mockRestoreInventoryForEvents = vi.fn().mockResolvedValue(undefined);

	const makeWhereChain = (queue: any[][]) =>
		vi.fn(() => {
			const next = queue.shift() ?? [];
			return Promise.resolve(next);
		});

	const mockDb: any = {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: makeWhereChain(selectResults)
			}))
		})),
		update: vi.fn(() => ({
			set: vi.fn(() => ({
				where: vi.fn().mockResolvedValue(undefined)
			}))
		})),
		delete: vi.fn(() => ({
			where: vi.fn().mockResolvedValue(undefined)
		})),
		query: {
			event: {
				findFirst: vi.fn().mockResolvedValue(null)
			}
		}
	};

	return {
		mockDb,
		selectResults,
		mockStorageDelete,
		mockDeleteEventMappings,
		mockSyncItems,
		mockPublishEventChange,
		mockInvalidateEvent,
		mockRestoreInventoryForEvents
	};
});

vi.mock('@ac/db', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@ac/db')>();
	return {
		...actual,
		db: mockDb
	};
});

vi.mock('#lib/server/sync/service.js', () => ({
	syncService: {
		deleteEventMappings: mockDeleteEventMappings,
		syncItems: mockSyncItems
	}
}));

vi.mock('#lib/server/blob-storage/index.js', () => ({
	getStorageProvider: () => ({
		delete: mockStorageDelete
	})
}));

vi.mock('#lib/server/realtime.js', () => ({
	publishEventChange: mockPublishEventChange
}));

vi.mock('#lib/server/cache/index.js', () => ({
	invalidateEvent: mockInvalidateEvent
}));

vi.mock('./sales.js', () => ({
	restoreInventoryForEvents: mockRestoreInventoryForEvents
}));

import { revertMaterializedExceptions } from './exceptions';

describe('revertMaterializedExceptions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		selectResults.length = 0;
		mockDb.query.event.findFirst.mockResolvedValue(null);
	});

	it('cleans up syncs, storage assets, inventory, lazy tables, orphaned campaigns, removes matching master exdate, and resyncs master', async () => {
		const exceptionRow = {
			id: 'exc-uuid-1',
			recurringEventId: 'master-uuid-1',
			campaignId: 'exc-camp-1',
			qrCodePath: 'https://blob.example/qr-exc-1.png',
			iCalPath: 'https://blob.example/exc-1.ics',
			startDateTime: new Date('2026-11-15T14:00:00.000Z'),
			originalStartTime: { dateTime: '2026-11-15T10:00:00.000Z' },
			isException: true
		};
		const masterRow = {
			id: 'master-uuid-1',
			exdates: ['2026-11-15T10:00:00.000Z', '2026-11-22T10:00:00.000Z']
		};

		// Queue of db.select().from(...).where(...) responses in execution order:
		// 1) candidateRows from event
		// 2) master row lookup for exdates check
		// 3) remaining events referencing exc-camp-1
		// 4) remaining announcements referencing exc-camp-1
		selectResults.push(
			[exceptionRow],
			[masterRow],
			[],
			[]
		);

		const result = await revertMaterializedExceptions({
			userId: 'user-1',
			eventIds: ['exc-uuid-1']
		});

		expect(result).toEqual({
			deletedIds: ['exc-uuid-1'],
			affectedMasterIds: ['master-uuid-1'],
			revertedVirtualIds: ['master-uuid-1_inst_2026-11-15T10:00:00.000Z']
		});

		expect(mockRestoreInventoryForEvents).toHaveBeenCalledWith(['exc-uuid-1']);
		expect(mockStorageDelete).toHaveBeenCalledWith('https://blob.example/qr-exc-1.png');
		expect(mockStorageDelete).toHaveBeenCalledWith('https://blob.example/exc-1.ics');
		expect(mockDeleteEventMappings).toHaveBeenCalledWith('user-1', ['exc-uuid-1']);

		// Master exdates updated to keep only unrelated exdate (2026-11-22), removing 2026-11-15
		expect(mockDb.update).toHaveBeenCalledTimes(1);

		// emailCampaign + syncMapping + event + orphaned campaign deleted (4 delete calls)
		expect(mockDb.delete).toHaveBeenCalledTimes(4);

		// Master re-synced & realtime/caches updated
		expect(mockSyncItems).toHaveBeenCalledWith('user-1', ['master-uuid-1'], 'event');
		expect(mockPublishEventChange).toHaveBeenCalledWith('delete', ['exc-uuid-1']);
		expect(mockPublishEventChange).toHaveBeenCalledWith('update', ['master-uuid-1']);
		expect(mockInvalidateEvent).toHaveBeenCalledWith([
			'exc-uuid-1',
			'master-uuid-1',
			'master-uuid-1_inst_2026-11-15T10:00:00.000Z'
		]);
	});

	it('skips non-exception events such as series masters or standalone events', async () => {
		selectResults.push([
			{
				id: 'master-uuid-1',
				recurringEventId: null,
				campaignId: 'master-camp-1',
				qrCodePath: null,
				iCalPath: null,
				startDateTime: new Date('2026-11-01T10:00:00.000Z'),
				originalStartTime: null,
				isException: false
			}
		]);

		const result = await revertMaterializedExceptions({
			userId: 'user-1',
			eventIds: ['master-uuid-1']
		});

		expect(result).toEqual({
			deletedIds: [],
			affectedMasterIds: [],
			revertedVirtualIds: []
		});
		expect(mockDeleteEventMappings).not.toHaveBeenCalled();
		expect(mockDb.delete).not.toHaveBeenCalled();
		expect(mockSyncItems).not.toHaveBeenCalled();
	});

	it('does not delete a campaign still shared with master or sibling events', async () => {
		const exceptionRow = {
			id: 'exc-uuid-2',
			recurringEventId: 'master-uuid-2',
			campaignId: 'shared-camp-1',
			qrCodePath: null,
			iCalPath: null,
			startDateTime: new Date('2026-11-29T10:00:00.000Z'),
			originalStartTime: { dateTime: '2026-11-29T10:00:00.000Z' },
			isException: true
		};

		selectResults.push(
			[exceptionRow],
			[{ id: 'master-uuid-2', exdates: [] }],
			[{ id: 'master-uuid-2' }] // shared-camp-1 still referenced by master
		);

		const result = await revertMaterializedExceptions({
			userId: 'user-1',
			eventIds: ['exc-uuid-2']
		});

		expect(result.deletedIds).toEqual(['exc-uuid-2']);
		// emailCampaign + syncMapping + event = 3 deletes (campaign NOT deleted)
		expect(mockDb.delete).toHaveBeenCalledTimes(3);
	});
});
