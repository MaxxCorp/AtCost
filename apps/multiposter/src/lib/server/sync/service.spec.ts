
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncService } from './service';
import type { SyncConfig } from './types';
import { db } from '@ac/db';
import {
	syncMapping as syncMappingTable,
	event as eventTable,
	syncConfig as syncConfigTable,
	syncOperation as syncOperationTable,
	campaign as campaignTable,
	announcement as announcementTable
} from '@ac/db';
import { eq, and } from '@ac/db';
import { getEntityContacts } from '../contacts';
import { WpTheEventsCalendarProvider } from './providers/wp-the-events-calendar';
import { BerlinDeMhCalendarProvider } from './providers/berlin-de-mh-calendar';
import { BerlinDeMainCalendarProvider } from './providers/berlin-de-main-calendar';

// Mock the database
vi.mock('@ac/db', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@ac/db')>();
	return {
		...actual,
		db: {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			limit: vi.fn().mockReturnThis(),
			leftJoin: vi.fn().mockReturnThis(),
			innerJoin: vi.fn().mockReturnThis(),
			insert: vi.fn().mockReturnThis(),
			values: vi.fn().mockReturnThis(),
			onConflictDoUpdate: vi.fn().mockReturnThis(),
			returning: vi.fn().mockReturnThis(),
			update: vi.fn().mockReturnThis(),
			set: vi.fn().mockReturnThis(),
			delete: vi.fn().mockReturnThis(),
			query: {
				contact: {
					findMany: vi.fn().mockResolvedValue([])
				}
			}
		}
	};
});

// Mock the realtime publisher
vi.mock('../realtime', () => ({
	publishEventChange: vi.fn().mockResolvedValue(undefined)
}));

// Mock contact resolution
vi.mock('../contact-resolution', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../contact-resolution')>();
	return {
		...actual,
		resolveEventContact: vi.fn().mockResolvedValue(null)
	};
});

// Mock contacts
vi.mock('../contacts', () => ({
	getEntityContacts: vi.fn().mockResolvedValue([])
}));

// Mock cache invalidation to prevent real Redis client activation
vi.mock('#lib/server/cache/index.js', () => ({
	invalidateEvent: vi.fn().mockResolvedValue(undefined)
}));

describe('SyncService - processExternalEvent deduplication', () => {
	let service: SyncService;
	const mockConfig = { id: 'config-1', userId: 'user-1', providerId: 'provider-1' } as any;

	beforeEach(() => {
		vi.resetAllMocks();
		(db.delete as any).mockReturnValue({ where: vi.fn().mockResolvedValue({}) });
		vi.mocked(getEntityContacts).mockResolvedValue([]);
		service = new SyncService();
	});

	it('should identify internal ID from deterministic Google external ID (mp... format)', async () => {
		const internalUuid = '550e8400-e29b-41d4-a716-446655440000';
		const deterministicId = 'mp550e8400e29b41d4a716446655440000';
		const externalEvent = {
			externalId: deterministicId,
			summary: 'Echo Test',
			status: 'confirmed'
		} as any;

		// 1a. Mock campaign mapping check (no campaign mapping found)
		(db.select as any).mockReturnValueOnce({
			from: vi.fn().mockReturnValueOnce({
				where: vi.fn().mockResolvedValueOnce([])
			})
		});

		// 1b. Mock legacy mapping check (no mapping found)
		(db.select as any).mockReturnValueOnce({
			from: vi.fn().mockReturnValueOnce({
				where: vi.fn().mockResolvedValueOnce([])
			})
		});

		// 2. Mock individual event check (event found by ID reconstruction)
		(db.select as any).mockReturnValueOnce({
			from: vi.fn().mockReturnValueOnce({
				where: vi.fn().mockResolvedValueOnce([{ id: internalUuid, summary: 'Local Event' }])
			})
		});

		// 3. Mock campaign insertion and event update
		(db.insert as any).mockReturnValueOnce({
			values: vi.fn().mockReturnValueOnce({
				returning: vi.fn().mockResolvedValueOnce([{ id: 'camp-echo' }])
			})
		});
		(db.update as any).mockReturnValueOnce({
			set: vi.fn().mockReturnValueOnce({
				where: vi.fn().mockResolvedValueOnce({})
			})
		});

		// @ts-ignore - accessing private method for testing
		await service.processExternalEvent(mockConfig, externalEvent);

		// Verify it tried to fetch the event by UUID
		expect(db.select).toHaveBeenCalled();
		
		// Verify campaign was created/updated instead of syncMappingTable
		expect(db.insert).toHaveBeenCalledWith(campaignTable);
		expect(db.insert).not.toHaveBeenCalledWith(syncMappingTable);
	});

	it('should handle partial updates and NOT overwrite existing fields with null/undefined', async () => {
		const eventId = 'event-123';
		const externalEvent = {
			externalId: 'ext-123',
			summary: 'Updated Summary',
			// description: undefined, // Missing field
			status: 'confirmed'
		} as any;

		// 1a. Mock campaign mapping check (no campaign mapping found)
		(db.select as any).mockReturnValueOnce({
			from: vi.fn().mockReturnValueOnce({
				where: vi.fn().mockResolvedValueOnce([])
			})
		});

		// 1b. Mock legacy mapping exists
		(db.select as any).mockReturnValueOnce({
			from: vi.fn().mockReturnValueOnce({
				where: vi.fn().mockResolvedValueOnce([{ id: 'map-1', eventId }])
			})
		});

		// 2. Mock current event fetch
		(db.select as any).mockReturnValueOnce({
			from: vi.fn().mockReturnValueOnce({
				where: vi.fn().mockResolvedValueOnce([{ 
                    id: eventId, 
                    summary: 'Old Summary', 
                    description: 'Keep me!',
                    updatedAt: new Date(Date.now() - 60000) // Older than 30s
                }])
			})
		});

		// 3. Mock update
		const updateMock = vi.fn().mockResolvedValueOnce({});
		(db.update as any).mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: updateMock
			})
		});

		// @ts-ignore
		await service.processExternalEvent(mockConfig, externalEvent);

		// Verify update call
		expect(db.update).toHaveBeenCalledWith(eventTable);
		
		// Verify description was NOT in the update object
		const updateSetCall = (db.update(eventTable).set as any).mock.calls[0][0];
		expect(updateSetCall.summary).toBe('Updated Summary');
		expect(updateSetCall).not.toHaveProperty('description');
	});

	it('should update local event status to cancelled when external cancellation is received', async () => {
		const eventId = 'event-456';
		const externalEvent = {
			externalId: 'ext-456',
			summary: 'Cancelled Meeting',
			status: 'cancelled',
			etag: 'etag-123'
		} as any;

		// 1a. Mock campaign mapping check (no campaign mapping found)
		(db.select as any).mockReturnValueOnce({
			from: vi.fn().mockReturnValueOnce({
				where: vi.fn().mockResolvedValueOnce([])
			})
		});

		// 1b. Mock legacy mapping exists
		(db.select as any).mockReturnValueOnce({
			from: vi.fn().mockReturnValueOnce({
				where: vi.fn().mockResolvedValueOnce([{ id: 'map-456', eventId }])
			})
		});

		// Mock update for eventTable and syncMappingTable
		const updateWhereMock = vi.fn().mockResolvedValue({});
		(db.update as any).mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: updateWhereMock
			})
		});

		// @ts-ignore
		await service.processExternalEvent(mockConfig, externalEvent);

		// Verify eventTable was updated with status: 'cancelled'
		expect(db.update).toHaveBeenCalledWith(eventTable);
		const eventUpdateSet = (db.update(eventTable).set as any).mock.calls[0][0];
		expect(eventUpdateSet.status).toBe('cancelled');

		// Verify syncMappingTable legacy entry was deleted (migrated out)
		expect(db.delete).toHaveBeenCalledWith(syncMappingTable);
		expect(db.update).not.toHaveBeenCalledWith(syncMappingTable);

		// Verify eventTable was NOT deleted
		expect(db.delete).not.toHaveBeenCalledWith(eventTable);
	});
});

describe('SyncService - mapInternalToExternal status mapping', () => {
	let service: SyncService;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getEntityContacts).mockResolvedValue([]);
		service = new SyncService();

		// Mock db.select for associations in mapInternalToExternal
		(db.select as any).mockReturnValue({
			from: vi.fn().mockReturnValue({
				innerJoin: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([])
				}),
				where: vi.fn().mockResolvedValue([])
			})
		});
	});

	it('should map status field to external event', async () => {
		const internalCancelled = {
			id: 'evt-1',
			summary: 'Team Sync',
			status: 'cancelled',
			startDateTime: new Date('2026-09-01T10:00:00Z'),
			endDateTime: new Date('2026-09-01T11:00:00Z')
		};

		// @ts-ignore - private method
		const externalResult = await service.mapInternalToExternal(internalCancelled, 'microsoft-calendar');

		expect(externalResult.status).toBe('cancelled');
		expect(externalResult.summary).toBe('Team Sync');
	});

	it('should only include contacts tagged as Employee in attendees and exclude external contacts', async () => {
		const internalEvent = {
			id: 'evt-2',
			summary: 'Privacy Test Event',
			status: 'confirmed',
			startDateTime: new Date('2026-09-01T10:00:00Z'),
			endDateTime: new Date('2026-09-01T11:00:00Z')
		};

		// Mock associated contacts: one Employee, one External
		vi.mocked(getEntityContacts).mockResolvedValueOnce([
			{
				id: 'contact-emp',
				displayName: 'Employee Staff',
				emails: [{ value: 'employee@company.com', primary: true }],
				tags: [{ name: 'Employee' }]
			},
			{
				id: 'contact-ext',
				displayName: 'External Guest',
				emails: [{ value: 'guest@external.com', primary: true }],
				tags: [{ name: 'Customer' }]
			}
		]);

		// Mock db.select for eventContactTable association
		(db.select as any).mockReturnValue({
			from: vi.fn().mockReturnValue({
				innerJoin: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([])
				}),
				where: vi.fn().mockReturnValue({
					limit: vi.fn().mockResolvedValue([{ participationStatus: 'accepted' }])
				})
			})
		});

		// @ts-ignore - private method
		const externalResult = await service.mapInternalToExternal(internalEvent, 'google-calendar');

		expect(externalResult.attendees).toBeDefined();
		expect(externalResult.attendees).toHaveLength(1);
		expect(externalResult.attendees![0]).toEqual({
			email: 'employee@company.com',
			displayName: 'Employee Staff',
			responseStatus: 'accepted'
		});
	});

	it('should map announcement with entityType and announcementId in metadata', async () => {
		const internalAnnouncement = {
			id: 'ann-1',
			title: 'Community Announcement',
			content: 'Important updates',
			status: 'active',
			isPublic: true,
			updatedAt: new Date()
		};

		// @ts-ignore - private method
		const externalResult = await service.mapInternalToExternal(internalAnnouncement, 'email');

		expect(externalResult.summary).toBe('Community Announcement');
		expect(externalResult.metadata?.entityType).toBe('announcement');
		expect(externalResult.metadata?.announcementId).toBe('ann-1');
	});
});

describe('SyncService - Bulk Sync', () => {
	let service: SyncService;
	class MockSyncProvider {
		providerType = 'mock-provider' as any;
		supportedEntityTypes = ['event'];
		initialize = vi.fn().mockResolvedValue(undefined);
		pullEvents = vi.fn().mockResolvedValue({ events: [] });
		pushEvent = vi.fn().mockResolvedValue({ externalId: 'ext-mock-1', etag: 'etag-1' });
		updateEvent = vi.fn().mockResolvedValue({ etag: 'etag-2' });
		deleteEvent = vi.fn().mockResolvedValue(undefined);
	}

	beforeEach(() => {
		vi.resetAllMocks();
		(db.delete as any).mockReturnValue({
			where: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([])
			})
		});
		vi.mocked(getEntityContacts).mockResolvedValue([]);
		service = new SyncService();
		service.registerProvider('mock-provider' as any, MockSyncProvider as any);
	});

	it('should throw error if config does not exist or is disabled', async () => {
		(db.select as any).mockReturnValueOnce({
			from: vi.fn().mockReturnValueOnce({
				where: vi.fn().mockResolvedValueOnce([])
			})
		});

		await expect(service.startBulkSync('non-existent')).rejects.toThrow(
			/Sync config not found or disabled/
		);
	});

	it('should fail bulk sync and insert failed operation when validateCalendarAccess rejects', async () => {
		const configId = 'config-ms-invalid';
		const mockConfigRow = {
			id: configId,
			userId: 'user-1',
			providerId: 'provider-1',
			providerType: 'mock-provider-failing-calendar',
			direction: 'push',
			enabled: true,
			createdAt: new Date(),
			updatedAt: new Date()
		};

		class FailingCalendarProvider {
			type = 'mock-provider-failing-calendar';
			supportedEntityTypes = ['event'];
			initialize = vi.fn().mockResolvedValue(undefined);
			validateCalendarAccess = vi.fn().mockRejectedValue(
				new Error('Microsoft Calendar sync failed: Specified primary calendar is not available or accessible (404).')
			);
			pullEvents = vi.fn();
			pushEvent = vi.fn();
		}

		service.registerProvider('mock-provider-failing-calendar' as any, FailingCalendarProvider as any);

		// Config lookup
		(db.select as any).mockReturnValueOnce({
			from: vi.fn().mockReturnValueOnce({
				where: vi.fn().mockResolvedValueOnce([mockConfigRow])
			})
		});

		const insertValuesMock = vi.fn().mockReturnValue({
			returning: vi.fn().mockResolvedValue([{ id: 'op-failed' }])
		});
		(db.insert as any).mockReturnValue({
			values: insertValuesMock
		});

		await expect(service.startBulkSync(configId)).rejects.toThrow(
			'Microsoft Calendar sync failed: Specified primary calendar is not available or accessible (404).'
		);

		expect(insertValuesMock).toHaveBeenCalledWith(
			expect.objectContaining({
				syncConfigId: configId,
				status: 'failed',
				error: expect.stringContaining('Specified primary calendar is not available or accessible')
			})
		);
	});

	it('should build queue including standalone event and recurring instance with healed campaign', async () => {
		const configId = 'config-bulk-1';
		const mockConfigRow = {
			id: configId,
			userId: 'user-1',
			providerId: 'provider-1',
			providerType: 'mock-provider',
			direction: 'push',
			enabled: true,
			createdAt: new Date(),
			updatedAt: new Date()
		};

		// 1. Config lookup
		(db.select as any).mockReturnValueOnce({
			from: vi.fn().mockReturnValueOnce({
				where: vi.fn().mockResolvedValueOnce([mockConfigRow])
			})
		});

		// 2. Existing mappings lookup
		(db.select as any).mockReturnValueOnce({
			from: vi.fn().mockReturnValueOnce({
				where: vi.fn().mockResolvedValueOnce([])
			})
		});

		// 3. Events with campaign lookup:
		// - event 1: standalone event with campaign containing configId
		// - event 2: recurring instance with null campaign, but recurringEventId: 'master-1'
		const standaloneEvent = {
			id: 'event-standalone',
			summary: 'Standalone Event',
			isPublic: true,
			status: 'confirmed'
		};
		const instanceEvent = {
			id: 'event-instance',
			summary: 'Instance Event',
			isPublic: true,
			status: 'confirmed',
			recurringEventId: 'master-1'
		};
		const campaignObj = {
			id: 'camp-1',
			content: { syncIds: [configId] }
		};

		(db.select as any).mockReturnValueOnce({
			from: vi.fn().mockReturnValueOnce({
				leftJoin: vi.fn().mockResolvedValueOnce([
					{ event: standaloneEvent, campaign: campaignObj },
					{ event: instanceEvent, campaign: null }
				])
			})
		});

		// 4. Master events lookup for instances needing master:
		(db.select as any).mockReturnValueOnce({
			from: vi.fn().mockReturnValueOnce({
				leftJoin: vi.fn().mockReturnValueOnce({
					where: vi.fn().mockResolvedValueOnce([
						{
							event: { id: 'master-1', summary: 'Master Series' },
							campaign: campaignObj
						}
					])
				})
			})
		});

		// 5. Update call for healing instance campaignId in DB
		(db.update as any).mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValueOnce({})
			})
		});

		// 6. Insert into syncOperationTable
		const valuesSpy = vi.fn().mockReturnValue({
			returning: vi.fn().mockResolvedValue([{ id: 'op-123' }])
		});
		(db.insert as any).mockReturnValue({
			values: valuesSpy
		});

		const result = await service.startBulkSync(configId);

		expect(result.operationId).toBe('op-123');
		expect(result.total).toBe(2);
		expect(result.done).toBe(false);

		// Verify healing update was performed on instance
		expect(db.update).toHaveBeenCalledWith(eventTable);

		// Verify syncOperationTable insert recorded the queued items
		const insertOpCall = valuesSpy.mock.calls[0][0];
		expect(insertOpCall.results.total).toBe(2);
		expect(insertOpCall.results.itemsToSync).toEqual([
			{ id: 'event-standalone', entityType: 'event', action: 'sync' },
			{ id: 'event-instance', entityType: 'event', action: 'sync' }
		]);
	});

	it('should process a batch of items and update operation progress', async () => {
		const configId = 'config-bulk-1';
		const opId = 'op-123';

		const mockOpRow = {
			id: opId,
			syncConfigId: configId,
			status: 'pending',
			results: {
				total: 1,
				processed: 0,
				pushed: 0,
				errors: [],
				itemsToSync: [{ id: 'event-standalone', entityType: 'event', action: 'sync' }]
			}
		};

		// 1. Operation lookup
		(db.select as any).mockReturnValueOnce({
			from: vi.fn().mockReturnValueOnce({
				where: vi.fn().mockResolvedValueOnce([mockOpRow])
			})
		});

		// 2. Config lookup
		const mockConfigRow = {
			id: configId,
			userId: 'user-1',
			providerId: 'provider-1',
			providerType: 'mock-provider',
			direction: 'push',
			enabled: true,
			createdAt: new Date(),
			updatedAt: new Date()
		};
		(db.select as any).mockReturnValueOnce({
			from: vi.fn().mockReturnValueOnce({
				where: vi.fn().mockResolvedValueOnce([mockConfigRow])
			})
		});

		// 3. executeSyncItem mocks:
		// item lookup:
		(db.select as any).mockReturnValueOnce({
			from: vi.fn().mockReturnValueOnce({
				where: vi.fn().mockResolvedValueOnce([{
					id: 'event-standalone',
					summary: 'Standalone Event',
					isPublic: true,
					status: 'confirmed',
					startDateTime: new Date('2026-09-01T10:00:00Z'),
					endDateTime: new Date('2026-09-01T11:00:00Z')
				}])
			})
		});
		// mapping lookup:
		(db.select as any).mockReturnValueOnce({
			from: vi.fn().mockReturnValueOnce({
				where: vi.fn().mockResolvedValueOnce([])
			})
		});
		// mapInternalToExternal mocks associations (innerJoin/where)
		(db.select as any).mockReturnValue({
			from: vi.fn().mockReturnValue({
				innerJoin: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([])
				}),
				where: vi.fn().mockResolvedValue([])
			})
		});
		// campaign/mapping insert
		(db.insert as any).mockReturnValue({
			values: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([{ id: 'new-camp-id' }])
			})
		});
		// operation update
		(db.update as any).mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue({})
			})
		});

		const batchResult = await service.processBulkSyncBatch(configId, opId, 10);

		expect(batchResult.done).toBe(true);
		expect(batchResult.processed).toBe(1);
		expect(batchResult.pushed).toBe(1);
		expect(batchResult.errors).toHaveLength(0);
	});

	describe('pruneOldOperations', () => {
		it('deletes completed operations older than retention threshold and stale pending operations', async () => {
			const service = new SyncService();

			const deleteMock = vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					returning: vi.fn()
						.mockResolvedValueOnce([{ id: 'completed-old-1' }, { id: 'completed-old-2' }])
						.mockResolvedValueOnce([{ id: 'stale-pending-1' }])
				})
			});
			(db.delete as any) = deleteMock;

			const result = await service.pruneOldOperations(48);

			expect(deleteMock).toHaveBeenCalledTimes(2);
			expect(result).toEqual({
				deletedCompleted: 2,
				deletedStalePending: 1
			});
		});

		it('supports custom retention hours', async () => {
			const service = new SyncService();

			const returningMock = vi.fn()
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([]);
			const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
			const deleteMock = vi.fn().mockReturnValue({ where: whereMock });
			(db.delete as any) = deleteMock;

			const result = await service.pruneOldOperations(24);

			expect(deleteMock).toHaveBeenCalledTimes(2);
			expect(result).toEqual({
				deletedCompleted: 0,
				deletedStalePending: 0
			});
		});
	});

	describe('getMaxSyncDurationMs', () => {
		it('defaults to 60000ms when no setting is found', () => {
			const service = new SyncService();
			expect(service.getMaxSyncDurationMs()).toBe(60000);
		});

		it('respects per-config maxDurationSeconds or timeoutSeconds', () => {
			const service = new SyncService();
			expect(service.getMaxSyncDurationMs({ settings: { maxDurationSeconds: 40 } } as any)).toBe(40000);
			expect(service.getMaxSyncDurationMs({ settings: { timeoutSeconds: 30 } } as any)).toBe(30000);
		});

		it('respects process.env.SYNC_MAX_DURATION_SECONDS', () => {
			const originalEnv = process.env.SYNC_MAX_DURATION_SECONDS;
			try {
				process.env.SYNC_MAX_DURATION_SECONDS = '45';
				const service = new SyncService();
				expect(service.getMaxSyncDurationMs()).toBe(45000);
			} finally {
				if (originalEnv !== undefined) {
					process.env.SYNC_MAX_DURATION_SECONDS = originalEnv;
				} else {
					delete process.env.SYNC_MAX_DURATION_SECONDS;
				}
			}
		});
	});

	describe('Series Sync & Recurrence Handling', () => {
		it('identifies series master correctly with isSeriesMaster', () => {
			const service = new SyncService();

			expect(service.isSeriesMaster({
				id: 'master-1',
				recurrence: ['RRULE:FREQ=WEEKLY;COUNT=5'],
				isException: false
			})).toBe(true);

			// Single event
			expect(service.isSeriesMaster({
				id: 'single-1',
				recurrence: null,
				isException: false
			})).toBe(false);

			// Exception event
			expect(service.isSeriesMaster({
				id: 'exception-1',
				recurrence: null,
				recurringEventId: 'master-1',
				isException: true
			})).toBe(false);

			// Virtual occurrence
			expect(service.isSeriesMaster({
				id: 'master-1_inst_2026-09-01T10:00:00.000Z',
				recurrence: null
			})).toBe(false);
		});

		it('marks WpTheEventsCalendarProvider as supportsNativeRecurrence = false', () => {
			const wpProvider = new WpTheEventsCalendarProvider();
			expect(wpProvider.supportsNativeRecurrence).toBe(false);
		});

		it('marks BerlinDeMhCalendarProvider as supportsNativeRecurrence = false and rejects series sync', () => {
			const mhProvider = new BerlinDeMhCalendarProvider();
			expect(mhProvider.supportsNativeRecurrence).toBe(false);

			// Series master should NOT be synced to Berlin.de MH
			const seriesMaster = {
				id: 'series-master-1',
				recurrence: ['RRULE:FREQ=WEEKLY'],
				isPublic: true,
				status: 'confirmed',
				startDateTime: new Date(Date.now() + 86400000)
			};
			expect(mhProvider.shouldSyncEvent(seriesMaster)).toBe(false);

			// Virtual occurrence should NOT be synced to Berlin.de MH
			const virtualInst = {
				id: 'series-master-1_inst_2026-09-01T10:00:00.000Z',
				isPublic: true,
				status: 'confirmed',
				startDateTime: new Date(Date.now() + 86400000)
			};
			expect(mhProvider.shouldSyncEvent(virtualInst)).toBe(false);

			// Materialized exception should NOT be synced to Berlin.de MH
			const exceptionItem = {
				id: 'exc-1',
				recurringEventId: 'series-master-1',
				isException: true,
				isPublic: true,
				status: 'confirmed',
				startDateTime: new Date(Date.now() + 86400000)
			};
			expect(mhProvider.shouldSyncEvent(exceptionItem)).toBe(false);

			// Regular single event SHOULD be synced
			const standaloneEvent = {
				id: 'standalone-1',
				isPublic: true,
				status: 'confirmed',
				startDateTime: new Date(Date.now() + 86400000)
			};
			expect(mhProvider.shouldSyncEvent(standaloneEvent)).toBe(true);
		});

		it('marks BerlinDeMainCalendarProvider as supportsNativeRecurrence = false and rejects series sync', () => {
			const mainProvider = new BerlinDeMainCalendarProvider();
			expect(mainProvider.supportsNativeRecurrence).toBe(false);

			// Series master should NOT be synced to Berlin.de Main
			const seriesMaster = {
				id: 'series-master-1',
				recurrence: ['RRULE:FREQ=WEEKLY'],
				isPublic: true,
				status: 'confirmed',
				startDateTime: new Date(Date.now() + 86400000)
			};
			expect(mainProvider.shouldSyncEvent(seriesMaster)).toBe(false);

			// Virtual occurrence should NOT be synced to Berlin.de Main
			const virtualInst = {
				id: 'series-master-1_inst_2026-09-01T10:00:00.000Z',
				isPublic: true,
				status: 'confirmed',
				startDateTime: new Date(Date.now() + 86400000)
			};
			expect(mainProvider.shouldSyncEvent(virtualInst)).toBe(false);

			// Materialized exception should NOT be synced to Berlin.de Main
			const exceptionItem = {
				id: 'exc-1',
				recurringEventId: 'series-master-1',
				isException: true,
				isPublic: true,
				status: 'confirmed',
				startDateTime: new Date(Date.now() + 86400000)
			};
			expect(mainProvider.shouldSyncEvent(exceptionItem)).toBe(false);

			// Regular single event SHOULD be synced
			const standaloneEvent = {
				id: 'standalone-1',
				isPublic: true,
				status: 'confirmed',
				startDateTime: new Date(Date.now() + 86400000)
			};
			expect(mainProvider.shouldSyncEvent(standaloneEvent)).toBe(true);
		});

		it('expands master occurrence IDs for providers without native recurrence', async () => {
			const service = new SyncService();

			(db.select as any).mockReturnValueOnce({
				from: vi.fn().mockReturnValueOnce({
					where: vi.fn().mockResolvedValueOnce([])
				})
			});

			const masterEvent: any = {
				id: 'master-uuid',
				startDateTime: new Date('2026-10-18T10:00:00.000Z'),
				endDateTime: new Date('2026-10-18T11:00:00.000Z'),
				recurrence: ['RRULE:FREQ=DAILY;COUNT=3'],
				status: 'confirmed'
			};

			const occIds = await service.getMasterOccurrenceIds(masterEvent);
			expect(occIds).toHaveLength(3);
			expect(occIds[0]).toBe('master-uuid');
			expect(occIds[1]).toContain('master-uuid_inst_');
			expect(occIds[2]).toContain('master-uuid_inst_');
		});

		it('filters out past occurrences beyond windowPastDays for non-native providers', async () => {
			const service = new SyncService();

			(db.select as any).mockReturnValueOnce({
				from: vi.fn().mockReturnValueOnce({
					where: vi.fn().mockResolvedValueOnce([])
				})
			});

			const pastMasterEvent: any = {
				id: 'old-master-uuid',
				startDateTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
				endDateTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 + 3600000),
				recurrence: ['RRULE:FREQ=DAILY;COUNT=35'], // 30 in the past, 5 in current/future
				status: 'confirmed'
			};

			const occIds = await service.getMasterOccurrenceIds(pastMasterEvent, { windowPastDays: 14 });
			// Old master from 30 days ago should be excluded
			expect(occIds).not.toContain('old-master-uuid');
			// Only occurrences within the last 14 days and future should be included
			expect(occIds.length).toBeGreaterThan(0);
			expect(occIds.length).toBeLessThan(35);
		});
	});

	describe('deleteEventMappings', () => {
		it('should delete synced events and virtual instances from providers and clean campaign items', async () => {
			const service = new SyncService();
			const mockProviderInstance = new MockSyncProvider();
			service.registerProvider('mock-provider' as any, class extends MockSyncProvider {
				constructor() {
					super();
					return mockProviderInstance;
				}
			} as any);

			const configId = 'cfg-test-1';
			const mockConfigRow = {
				id: configId,
				userId: 'user-1',
				providerId: 'prov-1',
				providerType: 'mock-provider',
				direction: 'push',
				enabled: true,
				createdAt: new Date(),
				updatedAt: new Date()
			};

			const mockCampaign = {
				id: 'camp-1',
				userId: 'user-1',
				name: 'Test Campaign',
				content: {
					version: 1,
					targets: { [configId]: { enabled: true } },
					items: {
						'event-master-1': {
							entityType: 'event',
							syncs: {
								[configId]: { status: 'synced', externalId: 'ext-master-1' }
							}
						},
						'event-master-1_inst_2026-10-01T10:00:00.000Z': {
							entityType: 'event',
							syncs: {
								[configId]: { status: 'synced', externalId: 'ext-virtual-1' }
							}
						},
						'other-event': {
							entityType: 'event',
							syncs: {
								[configId]: { status: 'synced', externalId: 'ext-other-1' }
							}
						}
					},
					externalIds: {
						'ext-master-1': { itemId: 'event-master-1', configId },
						'ext-virtual-1': { itemId: 'event-master-1_inst_2026-10-01T10:00:00.000Z', configId },
						'ext-other-1': { itemId: 'other-event', configId }
					}
				},
				createdAt: new Date(),
				updatedAt: new Date()
			};

			// 1. Fetch configs
			(db.select as any).mockReturnValueOnce({
				from: vi.fn().mockResolvedValueOnce([mockConfigRow])
			});

			// 1.5. Fetch child exceptions
			(db.select as any).mockReturnValueOnce({
				from: vi.fn().mockReturnValueOnce({
					where: vi.fn().mockResolvedValueOnce([])
				})
			});

			// 2. Fetch campaigns containing event-master-1 or virtual instances
			(db.select as any).mockReturnValueOnce({
				from: vi.fn().mockReturnValueOnce({
					where: vi.fn().mockResolvedValueOnce([mockCampaign])
				})
			});

			// 3. Update campaign
			const mockUpdateSet = vi.fn().mockReturnValueOnce({
				where: vi.fn().mockResolvedValueOnce([])
			});
			(db.update as any).mockReturnValueOnce({
				set: mockUpdateSet
			});

			// 4. Fetch legacy mappings from syncMappingTable
			(db.select as any).mockReturnValueOnce({
				from: vi.fn().mockReturnValueOnce({
					where: vi.fn().mockResolvedValueOnce([
						{ id: 'map-1', syncConfigId: configId, eventId: 'event-master-1', externalId: 'ext-master-1' }
					])
				})
			});

			// 5. Delete legacy sync mappings
			(db.delete as any).mockReturnValueOnce({
				where: vi.fn().mockResolvedValueOnce([])
			});

			await service.deleteEventMappings('user-1', ['event-master-1']);

			// Both the master event and the virtual instance occurrence must be deleted from provider
			expect(mockProviderInstance.deleteEvent).toHaveBeenCalledWith('ext-master-1');
			expect(mockProviderInstance.deleteEvent).toHaveBeenCalledWith('ext-virtual-1');

			// ext-master-1 should NOT be deleted twice (deduplicated against legacy mapping)
			expect(mockProviderInstance.deleteEvent).toHaveBeenCalledTimes(2);

			// Check campaign content was cleaned
			expect(mockUpdateSet).toHaveBeenCalledWith(
				expect.objectContaining({
					content: expect.objectContaining({
						items: {
							'other-event': expect.any(Object)
						},
						externalIds: {
							'ext-other-1': expect.any(Object)
						}
					})
				})
			);
		});
	});

	describe('shouldSyncEventForConfig - Fine-grained Sync Filtering', () => {
		const service = new SyncService();
		const mockProvider = new MockSyncProvider() as any;

		const baseConfig = {
			id: 'cfg-1',
			userId: 'user-1',
			providerId: 'prov-1',
			providerType: 'microsoft-calendar' as const,
			direction: 'push' as const,
			enabled: true,
			settings: {},
			createdAt: new Date(),
			updatedAt: new Date()
		};

		const standaloneEvent = {
			id: 'event-1',
			summary: 'Single Concert',
			isPublic: true,
			status: 'confirmed',
			startDateTime: new Date(Date.now() + 86400000), // tomorrow
			endDateTime: new Date(Date.now() + 90000000),
			locationId: 'loc-1',
			tags: [{ id: 'tag-music', name: 'Music' }]
		};

		const seriesMasterEvent = {
			id: 'series-master-1',
			summary: 'Weekly Workshop',
			isPublic: true,
			status: 'confirmed',
			recurrence: ['RRULE:FREQ=WEEKLY'],
			startDateTime: new Date(Date.now() + 86400000),
			endDateTime: new Date(Date.now() + 90000000),
			locationId: 'loc-2',
			tags: [{ id: 'tag-edu', name: 'Education' }]
		};

		const virtualInstance = {
			id: 'series-master-1_inst_2026-11-01T10:00:00.000Z',
			summary: 'Weekly Workshop',
			isPublic: true,
			status: 'confirmed',
			startDateTime: new Date(Date.now() + 7 * 86400000),
			endDateTime: new Date(Date.now() + 7 * 86400000 + 3600000),
			locationId: 'loc-2',
			tags: [{ id: 'tag-edu', name: 'Education' }]
		};

		const materializedException = {
			id: 'exc-1',
			recurringEventId: 'series-master-1',
			isException: true,
			summary: 'Weekly Workshop (Special)',
			isPublic: true,
			status: 'confirmed',
			startDateTime: new Date(Date.now() + 14 * 86400000),
			endDateTime: new Date(Date.now() + 14 * 86400000 + 3600000),
			locationId: 'loc-2',
			tags: [{ id: 'tag-edu', name: 'Education' }]
		};

		it('allows standalone events and series when series are not excluded', () => {
			expect(service.shouldSyncEventForConfig(standaloneEvent, baseConfig, mockProvider)).toBe(true);
			expect(service.shouldSyncEventForConfig(seriesMasterEvent, baseConfig, mockProvider)).toBe(true);
			expect(service.shouldSyncEventForConfig(virtualInstance, baseConfig, mockProvider)).toBe(true);
			expect(service.shouldSyncEventForConfig(materializedException, baseConfig, mockProvider)).toBe(true);
		});

		it('rejects all series items when excludeSeries is true', () => {
			const config = { ...baseConfig, settings: { excludeSeries: true } };
			expect(service.shouldSyncEventForConfig(standaloneEvent, config, mockProvider)).toBe(true);
			expect(service.shouldSyncEventForConfig(seriesMasterEvent, config, mockProvider)).toBe(false);
			expect(service.shouldSyncEventForConfig(virtualInstance, config, mockProvider)).toBe(false);
			expect(service.shouldSyncEventForConfig(materializedException, config, mockProvider)).toBe(false);
		});

		it('rejects all series items when syncSeriesMode is exclude', () => {
			const config = { ...baseConfig, settings: { syncSeriesMode: 'exclude' } };
			expect(service.shouldSyncEventForConfig(standaloneEvent, config, mockProvider)).toBe(true);
			expect(service.shouldSyncEventForConfig(seriesMasterEvent, config, mockProvider)).toBe(false);
			expect(service.shouldSyncEventForConfig(virtualInstance, config, mockProvider)).toBe(false);
			expect(service.shouldSyncEventForConfig(materializedException, config, mockProvider)).toBe(false);
		});

		it('allows master event but rejects instances when syncSeriesMode is master_only', () => {
			const config = { ...baseConfig, settings: { syncSeriesMode: 'master_only' } };
			expect(service.shouldSyncEventForConfig(standaloneEvent, config, mockProvider)).toBe(true);
			expect(service.shouldSyncEventForConfig(seriesMasterEvent, config, mockProvider)).toBe(true);
			expect(service.shouldSyncEventForConfig(virtualInstance, config, mockProvider)).toBe(false);
			expect(service.shouldSyncEventForConfig(materializedException, config, mockProvider)).toBe(false);
		});

		it('enforces status exclusions (non-public, tentative, cancelled)', () => {
			const privateEvent = { ...standaloneEvent, isPublic: false };
			const tentativeEvent = { ...standaloneEvent, status: 'tentative' };
			const cancelledEvent = { ...standaloneEvent, status: 'cancelled' };

			// By default, non-public, tentative, and cancelled are excluded
			expect(service.shouldSyncEventForConfig(privateEvent, baseConfig, mockProvider)).toBe(false);
			expect(service.shouldSyncEventForConfig(tentativeEvent, baseConfig, mockProvider)).toBe(false);
			expect(service.shouldSyncEventForConfig(cancelledEvent, baseConfig, mockProvider)).toBe(false);

			// When explicitly allowed
			const allowAllConfig = {
				...baseConfig,
				settings: {
					excludeNonPublic: false,
					excludeTentative: false,
					excludeCancelled: false
				}
			};
			expect(service.shouldSyncEventForConfig(privateEvent, allowAllConfig, mockProvider)).toBe(true);
			expect(service.shouldSyncEventForConfig(tentativeEvent, allowAllConfig, mockProvider)).toBe(true);
			expect(service.shouldSyncEventForConfig(cancelledEvent, allowAllConfig, mockProvider)).toBe(true);
		});

		it('filters by rolling days window', () => {
			const pastEvent = {
				...standaloneEvent,
				startDateTime: new Date(Date.now() - 10 * 86400000),
				endDateTime: new Date(Date.now() - 10 * 86400000 + 3600000)
			};
			const futureFarEvent = {
				...standaloneEvent,
				startDateTime: new Date(Date.now() + 60 * 86400000),
				endDateTime: new Date(Date.now() + 60 * 86400000 + 3600000)
			};
			const rollingConfig = {
				...baseConfig,
				settings: {
					rangeMode: 'rolling',
					lookAheadDays: 30,
					lookPastDays: 0
				}
			};

			expect(service.shouldSyncEventForConfig(standaloneEvent, rollingConfig, mockProvider)).toBe(true);
			expect(service.shouldSyncEventForConfig(pastEvent, rollingConfig, mockProvider)).toBe(false);
			expect(service.shouldSyncEventForConfig(futureFarEvent, rollingConfig, mockProvider)).toBe(false);
		});

		it('filters by tag inclusion and exclusion', () => {
			const musicConfig = {
				...baseConfig,
				settings: { includedTags: ['tag-music'] }
			};
			expect(service.shouldSyncEventForConfig(standaloneEvent, musicConfig, mockProvider)).toBe(true);
			expect(service.shouldSyncEventForConfig(seriesMasterEvent, musicConfig, mockProvider)).toBe(false);

			const excludeMusicConfig = {
				...baseConfig,
				settings: { excludedTags: ['tag-music'] }
			};
			expect(service.shouldSyncEventForConfig(standaloneEvent, excludeMusicConfig, mockProvider)).toBe(false);
			expect(service.shouldSyncEventForConfig(seriesMasterEvent, excludeMusicConfig, mockProvider)).toBe(true);
		});

		it('filters by location inclusion and exclusion', () => {
			const loc1Config = {
				...baseConfig,
				settings: { includedLocationIds: ['loc-1'] }
			};
			expect(service.shouldSyncEventForConfig(standaloneEvent, loc1Config, mockProvider)).toBe(true);
			expect(service.shouldSyncEventForConfig(seriesMasterEvent, loc1Config, mockProvider)).toBe(false);

			const excludeLoc1Config = {
				...baseConfig,
				settings: { excludedLocationIds: ['loc-1'] }
			};
			expect(service.shouldSyncEventForConfig(standaloneEvent, excludeLoc1Config, mockProvider)).toBe(false);
			expect(service.shouldSyncEventForConfig(seriesMasterEvent, excludeLoc1Config, mockProvider)).toBe(true);
		});

		it('respects explicit event inclusion and exclusion overrides', () => {
			const excludeEventConfig = {
				...baseConfig,
				settings: { excludedEventIds: ['event-1'] }
			};
			expect(service.shouldSyncEventForConfig(standaloneEvent, excludeEventConfig, mockProvider)).toBe(false);

			const includeEventConfig = {
				...baseConfig,
				settings: { includedEventIds: ['event-1'] }
			};
			expect(service.shouldSyncEventForConfig(standaloneEvent, includeEventConfig, mockProvider)).toBe(true);
			expect(service.shouldSyncEventForConfig(seriesMasterEvent, includeEventConfig, mockProvider)).toBe(false);
		});
	});

	describe('SyncService - shouldSyncContactForEvent participant filtering', () => {
		let service: SyncService;
		const baseConfig = {
			id: 'config-cal-1',
			userId: 'user-1',
			providerType: 'microsoft-calendar',
			settings: {}
		} as any;

		const employeeContact = {
			id: 'ctc-emp-1',
			displayName: 'Alice Employee',
			emails: [{ value: 'alice@example.com', primary: true }],
			tags: [{ tag: { id: 'tag-emp', name: 'Employee' } }],
			roles: [{ id: 'role-organizer', name: 'Organizer' }]
		};

		const speakerContact = {
			id: 'ctc-spk-1',
			displayName: 'Bob Speaker',
			emails: [{ value: 'bob@guest.com', primary: true }],
			tags: [{ tag: { id: 'tag-vip', name: 'VIP Guest' } }],
			roles: [{ id: 'role-speaker', name: 'Keynote Speaker' }]
		};

		const volunteerContact = {
			id: 'ctc-vol-1',
			displayName: 'Charlie Volunteer',
			emails: [{ value: 'charlie@volunteer.com', primary: true }],
			tags: [{ tag: { id: 'tag-vol', name: 'Volunteer' } }],
			roles: [{ id: 'role-assistant', name: 'Assistant' }]
		};

		const publicSpeakerContact = {
			id: 'ctc-pub-1',
			displayName: 'Diana Public Keynote',
			isPublic: true,
			emails: [{ value: 'diana@keynote.com', primary: true }],
			tags: [{ tag: { id: 'tag-vip', name: 'VIP Guest' } }],
			roles: [{ id: 'role-speaker', name: 'Keynote Speaker' }]
		};

		beforeEach(() => {
			service = new SyncService();
		});

		it('defaults to internal staff only (non-public and unapproved contacts blocked by default)', () => {
			expect(service.shouldSyncContactForEvent(employeeContact, baseConfig)).toBe(true);
			expect(service.shouldSyncContactForEvent(speakerContact, baseConfig)).toBe(false);
			expect(service.shouldSyncContactForEvent(volunteerContact, baseConfig)).toBe(false);
			expect(service.shouldSyncContactForEvent(publicSpeakerContact, baseConfig)).toBe(false);
		});

		it('allows public contacts when includePublicContacts is true, while still blocking non-public contacts', () => {
			const config = {
				...baseConfig,
				settings: {
					includeEmployeeContacts: true,
					includePublicContacts: true,
					includeNonPublicContacts: false
				}
			};
			expect(service.shouldSyncContactForEvent(employeeContact, config)).toBe(true);
			expect(service.shouldSyncContactForEvent(publicSpeakerContact, config)).toBe(true);
			expect(service.shouldSyncContactForEvent(speakerContact, config)).toBe(false);
			expect(service.shouldSyncContactForEvent(volunteerContact, config)).toBe(false);
		});

		it('allows non-public contacts only when includeNonPublicContacts is explicitly true', () => {
			const config = {
				...baseConfig,
				settings: {
					includeEmployeeContacts: true,
					includePublicContacts: false,
					includeNonPublicContacts: true
				}
			};
			expect(service.shouldSyncContactForEvent(employeeContact, config)).toBe(true);
			expect(service.shouldSyncContactForEvent(speakerContact, config)).toBe(true);
			expect(service.shouldSyncContactForEvent(volunteerContact, config)).toBe(true);
			expect(service.shouldSyncContactForEvent(publicSpeakerContact, config)).toBe(false);
		});

		it('blocks all contacts when syncParticipants is false', () => {
			const config = {
				...baseConfig,
				settings: { syncParticipants: false }
			};
			expect(service.shouldSyncContactForEvent(employeeContact, config)).toBe(false);
			expect(service.shouldSyncContactForEvent(speakerContact, config)).toBe(false);
			expect(service.shouldSyncContactForEvent(volunteerContact, config)).toBe(false);
			expect(service.shouldSyncContactForEvent(publicSpeakerContact, config)).toBe(false);
		});

		it('restricts to employees when onlyEmployeeContacts is true', () => {
			const config = {
				...baseConfig,
				settings: { onlyEmployeeContacts: true }
			};
			expect(service.shouldSyncContactForEvent(employeeContact, config)).toBe(true);
			expect(service.shouldSyncContactForEvent(speakerContact, config)).toBe(false);
			expect(service.shouldSyncContactForEvent(volunteerContact, config)).toBe(false);
			expect(service.shouldSyncContactForEvent(publicSpeakerContact, config)).toBe(false);
		});

		it('filters by includedContactRoles', () => {
			const config = {
				...baseConfig,
				settings: {
					includeNonPublicContacts: true,
					participantRoleFilterMode: 'include',
					includedContactRoles: ['role-speaker']
				}
			};
			expect(service.shouldSyncContactForEvent(speakerContact, config)).toBe(true);
			expect(service.shouldSyncContactForEvent(employeeContact, config)).toBe(false);
			expect(service.shouldSyncContactForEvent(volunteerContact, config)).toBe(false);
		});

		it('filters by excludedContactRoles', () => {
			const config = {
				...baseConfig,
				settings: {
					includeNonPublicContacts: true,
					participantRoleFilterMode: 'exclude',
					excludedContactRoles: ['role-assistant']
				}
			};
			expect(service.shouldSyncContactForEvent(speakerContact, config)).toBe(true);
			expect(service.shouldSyncContactForEvent(employeeContact, config)).toBe(true);
			expect(service.shouldSyncContactForEvent(volunteerContact, config)).toBe(false);
		});

		it('filters by includedContactTags', () => {
			const config = {
				...baseConfig,
				settings: {
					includeNonPublicContacts: true,
					participantTagFilterMode: 'include',
					includedContactTags: ['VIP Guest']
				}
			};
			expect(service.shouldSyncContactForEvent(speakerContact, config)).toBe(true);
			expect(service.shouldSyncContactForEvent(employeeContact, config)).toBe(false);
			expect(service.shouldSyncContactForEvent(volunteerContact, config)).toBe(false);
		});

		it('filters by excludedContactTags', () => {
			const config = {
				...baseConfig,
				settings: {
					includeNonPublicContacts: true,
					participantTagFilterMode: 'exclude',
					excludedContactTags: ['tag-vol']
				}
			};
			expect(service.shouldSyncContactForEvent(speakerContact, config)).toBe(true);
			expect(service.shouldSyncContactForEvent(employeeContact, config)).toBe(true);
			expect(service.shouldSyncContactForEvent(volunteerContact, config)).toBe(false);
		});

		it('allows all roles when participantRoleFilterMode is "all" even if stale role lists exist', () => {
			const config = {
				...baseConfig,
				settings: {
					includeNonPublicContacts: true,
					participantRoleFilterMode: 'all',
					includedContactRoles: ['role-speaker']
				}
			};
			// All roles should be accepted since mode is 'all'
			expect(service.shouldSyncContactForEvent(speakerContact, config)).toBe(true);
			expect(service.shouldSyncContactForEvent(employeeContact, config)).toBe(true);
			expect(service.shouldSyncContactForEvent(volunteerContact, config)).toBe(true);
		});

		it('supports OR chaining between roles and tags using participantFilterLogic: OR', () => {
			const config = {
				...baseConfig,
				settings: {
					includeNonPublicContacts: true,
					participantRoleFilterMode: 'include',
					includedContactRoles: ['role-speaker'],
					participantTagFilterMode: 'include',
					includedContactTags: ['Volunteer'],
					participantFilterLogic: 'OR'
				}
			};
			// speakerContact has role-speaker (role match)
			expect(service.shouldSyncContactForEvent(speakerContact, config)).toBe(true);
			// volunteerContact has tag Volunteer (tag match)
			expect(service.shouldSyncContactForEvent(volunteerContact, config)).toBe(true);
			// employeeContact has neither
			expect(service.shouldSyncContactForEvent(employeeContact, config)).toBe(false);
		});

		it('supports OR chaining between base scope and filter criteria using participantScopeLogic: OR', () => {
			const config = {
				...baseConfig,
				settings: {
					// Base scope: staff only
					includeEmployeeContacts: true,
					includePublicContacts: false,
					includeNonPublicContacts: false,
					// Role filter: speaker
					participantRoleFilterMode: 'include',
					includedContactRoles: ['role-speaker'],
					// Scope OR Filters
					participantScopeLogic: 'OR'
				}
			};
			// employeeContact matches base scope (Staff)
			expect(service.shouldSyncContactForEvent(employeeContact, config)).toBe(true);
			// speakerContact is non-employee, but matches role filter in OR logic
			expect(service.shouldSyncContactForEvent(speakerContact, config)).toBe(true);
			// volunteerContact matches neither
			expect(service.shouldSyncContactForEvent(volunteerContact, config)).toBe(false);
		});

		it('should return false for all contacts when includeContacts is explicitly false', () => {
			const config = {
				id: 'cfg-no-contacts',
				providerType: 'microsoft-calendar',
				settings: {
					includeContacts: false
				}
			} as any;

			expect(service.shouldSyncContactForEvent(employeeContact, config)).toBe(false);
			expect(service.shouldSyncContactForEvent(speakerContact, config)).toBe(false);
		});

		it('should return true for eligible contacts when includeContacts is true', () => {
			const config = {
				id: 'cfg-contacts',
				providerType: 'microsoft-calendar',
				settings: {
					includeContacts: true
				}
			} as any;

			expect(service.shouldSyncContactForEvent(employeeContact, config)).toBe(true);
		});
	});
});



describe('SyncService - Public Data Leak Prevention', () => {
	let service: SyncService;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getEntityContacts).mockResolvedValue([]);
		service = new SyncService();
	});

	it('should exclude non-public locations, internal tags, non-public organizers, and non-work contact details in mapInternalToExternal', async () => {
		const internalEvent = {
			id: 'evt-privacy-sync',
			summary: 'Public Sync Event',
			status: 'confirmed',
			isPublic: true,
			startDateTime: new Date('2026-09-01T10:00:00Z'),
			endDateTime: new Date('2026-09-01T11:00:00Z')
		};

		// 1st contact: Non-public employee (should NOT become organizer)
		// 2nd contact: Public employee with personal primary email/phone + work secondary email/phone (should become organizer with work info ONLY)
		vi.mocked(getEntityContacts).mockResolvedValueOnce([
			{
				id: 'ctc-priv-emp',
				isPublic: false,
				displayName: 'Hidden Internal Employee',
				emails: [{ value: 'hidden@company.com', type: 'work', primary: true }],
				phones: [{ value: '+49-HIDDEN', type: 'work', primary: true }],
				tags: [{ name: 'Employee' }]
			},
			{
				id: 'ctc-pub-emp',
				isPublic: true,
				displayName: 'Public Organizer Employee',
				emails: [
					{ value: 'organizer.home@gmail.com', type: 'home', primary: true },
					{ value: 'organizer@company.com', type: 'work', primary: false }
				],
				phones: [
					{ value: '+49-170-PRIVATE', type: 'mobile', primary: true },
					{ value: '+49-30-OFFICE', type: 'work', primary: false }
				],
				tags: [{ name: 'Employee' }]
			}
		]);

		let joinCallCount = 0;
		(db.select as any).mockImplementation(() => ({
			from: vi.fn().mockReturnValue({
				innerJoin: vi.fn().mockReturnValue({
					where: vi.fn().mockImplementation(async () => {
						joinCallCount++;
						if (joinCallCount === 1) {
							// 1. Linked resources for calendar room bookings
							return [];
						}
						if (joinCallCount === 2) {
							// 2. Locations query: 1 private location, 1 public location
							return [
								{
									location: {
										id: 'loc-private',
										name: 'Secret Bunker',
										isPublic: false,
										city: 'Berlin'
									}
								},
								{
									location: {
										id: 'loc-public',
										name: 'Public Town Hall',
										isPublic: true,
										city: 'Berlin'
									}
								}
							];
						}
						if (joinCallCount === 3) {
							// 3. Tags query: 1 internal tag, 1 external tag
							return [
								{
									tag: {
										id: 'tag-internal',
										name: 'InternalBudget',
										visibility: 'internal'
									}
								},
								{
									tag: {
										id: 'tag-external',
										name: 'PublicCulture',
										visibility: 'external'
									}
								}
							];
						}
						return [];
					})
				}),
				where: vi.fn().mockReturnValue({
					limit: vi.fn().mockResolvedValue([{ participationStatus: 'accepted' }])
				})
			})
		}));

		// @ts-ignore - private method
		const externalResult = await service.mapInternalToExternal(internalEvent, 'wp-the-events-calendar');

		// Only the public location is mapped to venues/venue
		expect(externalResult.venues).toHaveLength(1);
		expect(externalResult.venue?.name).toBe('Public Town Hall');
		expect(externalResult.location).toContain('Public Town Hall');
		expect(externalResult.location).not.toContain('Secret Bunker');

		// Only the external tag is mapped to tags
		expect(externalResult.tags).toEqual([
			{ id: 'tag-external', name: 'PublicCulture' }
		]);

		// Organizer must be the public employee and must only expose work email & work phone
		expect(externalResult.organizer).toEqual({
			name: 'Public Organizer Employee',
			email: 'organizer@company.com',
			phone: '+49-30-OFFICE'
		});
		expect(externalResult.metadata?.organizerId).toBe('ctc-pub-emp');
	});

	it('excludes non-public materialized exceptions from getMasterOccurrenceIds while still blocking their virtual slot', async () => {
		const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
		start.setUTCHours(10, 0, 0, 0);
		const day2 = new Date(start.getTime() + 24 * 60 * 60 * 1000);
		const end = new Date(start.getTime() + 3600000);

		// Day 2 is a materialized exception that was marked non-public (isPublic: false)
		(db.select as any).mockReturnValueOnce({
			from: vi.fn().mockReturnValueOnce({
				where: vi.fn().mockResolvedValueOnce([
					{
						id: 'exc-private-day2',
						originalStartTime: { dateTime: day2.toISOString() },
						status: 'confirmed',
						isPublic: false
					}
				])
			})
		});

		const masterEvent: any = {
			id: 'master-uuid',
			startDateTime: start,
			endDateTime: end,
			recurrence: ['RRULE:FREQ=DAILY;COUNT=3'],
			status: 'confirmed',
			isPublic: true
		};

		const occIds = await service.getMasterOccurrenceIds(masterEvent, { excludeNonPublic: true });
		// 3 total days, day 2 is private exception -> only master (day 1) and virtual day 3 should be returned
		expect(occIds).toHaveLength(2);
		expect(occIds).toContain('master-uuid');
		expect(occIds).not.toContain('exc-private-day2');
		expect(occIds).not.toContain(`master-uuid_inst_${day2.toISOString()}`);
	});

	describe('SyncService - Recurring Series Instance Sync & Deduplication', () => {
		let service: SyncService;
		const configId = 'cfg-wp-1';
		const mockConfig: any = {
			id: configId,
			userId: 'user-1',
			providerType: 'wp-the-events-calendar',
			direction: 'push',
			enabled: true,
			settings: {}
		};

		beforeEach(() => {
			service = new SyncService();
			vi.clearAllMocks();
		});

		it('should migrate sync state from virtual instance to exception on executeSyncItem without creating duplicate', async () => {
			const start = new Date('2026-10-15T10:00:00.000Z');
			const end = new Date('2026-10-15T11:00:00.000Z');
			const virtualKey = `master-1_inst_${start.toISOString()}`;

			const mockProviderInstance: any = {
				supportedEntityTypes: ['event'],
				supportsNativeRecurrence: false,
				pushEvent: vi.fn().mockResolvedValue({ externalId: 'wp-new-duplicate', etag: 'etag-new' }),
				updateEvent: vi.fn().mockResolvedValue({ etag: 'etag-updated' }),
				deleteEvent: vi.fn().mockResolvedValue(undefined)
			};

			const mockCampaign: any = {
				id: 'camp-1',
				userId: 'user-1',
				content: {
					version: 1,
					targets: { [configId]: { enabled: true } },
					items: {
						[virtualKey]: {
							entityType: 'event',
							syncs: {
								[configId]: { status: 'synced', externalId: 'wp-100', lastSyncedAt: new Date().toISOString() }
							}
						}
					},
					externalIds: {
						'wp-100': { itemId: virtualKey, configId }
					}
				}
			};

			const exceptionRecord: any = {
				id: 'exc-uuid-1',
				summary: 'Instance with note',
				startDateTime: start,
				endDateTime: end,
				recurringEventId: 'master-1',
				originalStartTime: { dateTime: start.toISOString() },
				isException: true,
				status: 'confirmed',
				isPublic: true,
				campaignId: 'camp-1',
				userId: 'user-1'
			};

			// Mock db queries
			(db.select as any).mockReturnValue({
				from: vi.fn().mockReturnValue({
					innerJoin: vi.fn().mockReturnValue({
						where: vi.fn().mockResolvedValue([])
					}),
					leftJoin: vi.fn().mockReturnValue({
						where: vi.fn().mockResolvedValue([])
					}),
					where: vi.fn().mockResolvedValue([exceptionRecord])
				})
			});

			const mockUpdateSet = vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([])
			});
			(db.update as any).mockReturnValue({
				set: mockUpdateSet
			});

			const batchContext: any = {
				eventRecords: new Map([['exc-uuid-1', exceptionRecord]]),
				campaigns: new Map([['camp-1', mockCampaign]])
			};

			await service.executeSyncItem(mockConfig, mockProviderInstance, 'exc-uuid-1', 'event', batchContext);

			// Must update existing event wp-100 instead of pushing a duplicate
			expect(mockProviderInstance.updateEvent).toHaveBeenCalledWith('wp-100', expect.any(Object));
			expect(mockProviderInstance.pushEvent).not.toHaveBeenCalled();

			// Campaign content should now track exc-uuid-1 and virtualKey should be deleted
			const updatedContent = mockCampaign.content;
			expect(updatedContent.items['exc-uuid-1']).toBeDefined();
			expect(updatedContent.items['exc-uuid-1'].syncs[configId].externalId).toBe('wp-100');
			expect(updatedContent.items[virtualKey]).toBeUndefined();
			expect(updatedContent.externalIds['wp-100'].itemId).toBe('exc-uuid-1');
		});

		it('should unpublish/delete from provider when an exception is cancelled even if previously synced under virtual key', async () => {
			const start = new Date('2026-10-15T10:00:00.000Z');
			const end = new Date('2026-10-15T11:00:00.000Z');
			const virtualKey = `master-1_inst_${start.toISOString()}`;

			const mockProviderInstance: any = {
				supportedEntityTypes: ['event'],
				supportsNativeRecurrence: false,
				updateEvent: vi.fn().mockResolvedValue({ etag: 'etag-1' }),
				deleteEvent: vi.fn().mockResolvedValue(undefined)
			};

			const mockCampaign: any = {
				id: 'camp-1',
				userId: 'user-1',
				content: {
					version: 1,
					targets: { [configId]: { enabled: true } },
					items: {
						[virtualKey]: {
							entityType: 'event',
							syncs: {
								[configId]: { status: 'synced', externalId: 'wp-100', lastSyncedAt: new Date().toISOString() }
							}
						}
					},
					externalIds: {
						'wp-100': { itemId: virtualKey, configId }
					}
				}
			};

			const cancelledException: any = {
				id: 'exc-uuid-1',
				summary: 'Cancelled Instance',
				startDateTime: start,
				endDateTime: end,
				recurringEventId: 'master-1',
				originalStartTime: { dateTime: start.toISOString() },
				isException: true,
				status: 'cancelled',
				isPublic: true,
				campaignId: 'camp-1',
				userId: 'user-1'
			};

			(db.select as any).mockImplementation(() => ({
				from: vi.fn().mockImplementation(() => ({
					where: vi.fn().mockImplementation(() => Promise.resolve([cancelledException]))
				}))
			}));

			const mockUpdateSet = vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([])
			});
			(db.update as any).mockReturnValue({
				set: mockUpdateSet
			});

			const batchContext: any = {
				eventRecords: new Map([['exc-uuid-1', cancelledException]]),
				campaigns: new Map([['camp-1', mockCampaign]])
			};

			await (service as any).syncSingleItem(mockConfig, mockProviderInstance, 'exc-uuid-1', 'event', batchContext);

			// Should have deleted wp-100 from WordPress!
			expect(mockProviderInstance.deleteEvent).toHaveBeenCalledWith('wp-100');

			// Campaign content should be cleaned up
			const updatedContent = mockCampaign.content;
			expect(updatedContent.items[virtualKey]).toBeUndefined();
			expect(updatedContent.items['exc-uuid-1']?.syncs?.[configId]).toBeUndefined();
			expect(updatedContent.externalIds['wp-100']).toBeUndefined();
		});

		it('should clean up stale duplicate virtual occurrences from provider when exception sync runs', async () => {
			const start = new Date('2026-10-15T10:00:00.000Z');
			const end = new Date('2026-10-15T11:00:00.000Z');
			const virtualKey = `master-1_inst_${start.toISOString()}`;

			const mockProviderInstance: any = {
				supportedEntityTypes: ['event'],
				supportsNativeRecurrence: false,
				updateEvent: vi.fn().mockResolvedValue({ etag: 'etag-updated' }),
				deleteEvent: vi.fn().mockResolvedValue(undefined)
			};

			// Simulate stale state where both virtual key AND exception already had external IDs (duplicate on WP)
			const mockCampaign: any = {
				id: 'camp-1',
				userId: 'user-1',
				content: {
					version: 1,
					targets: { [configId]: { enabled: true } },
					items: {
						'exc-uuid-1': {
							entityType: 'event',
							syncs: {
								[configId]: { status: 'synced', externalId: 'wp-101', lastSyncedAt: new Date().toISOString() }
							}
						},
						[virtualKey]: {
							entityType: 'event',
							syncs: {
								[configId]: { status: 'synced', externalId: 'wp-100', lastSyncedAt: new Date().toISOString() }
							}
						}
					},
					externalIds: {
						'wp-100': { itemId: virtualKey, configId },
						'wp-101': { itemId: 'exc-uuid-1', configId }
					}
				}
			};

			const exceptionRecord: any = {
				id: 'exc-uuid-1',
				summary: 'Active Exception',
				startDateTime: start,
				endDateTime: end,
				recurringEventId: 'master-1',
				originalStartTime: { dateTime: start.toISOString() },
				isException: true,
				status: 'confirmed',
				isPublic: true,
				campaignId: 'camp-1',
				userId: 'user-1'
			};

			(db.select as any).mockReturnValue({
				from: vi.fn().mockReturnValue({
					innerJoin: vi.fn().mockReturnValue({
						where: vi.fn().mockResolvedValue([])
					}),
					leftJoin: vi.fn().mockReturnValue({
						where: vi.fn().mockResolvedValue([])
					}),
					where: vi.fn().mockResolvedValue([exceptionRecord])
				})
			});

			const mockUpdateSet = vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([])
			});
			(db.update as any).mockReturnValue({
				set: mockUpdateSet
			});

			const batchContext: any = {
				eventRecords: new Map([['exc-uuid-1', exceptionRecord]]),
				campaigns: new Map([['camp-1', mockCampaign]])
			};

			await service.executeSyncItem(mockConfig, mockProviderInstance, 'exc-uuid-1', 'event', batchContext);

			// Active item wp-101 should be updated
			expect(mockProviderInstance.updateEvent).toHaveBeenCalledWith('wp-101', expect.any(Object));

			// Duplicate wp-100 should be deleted from provider!
			expect(mockProviderInstance.deleteEvent).toHaveBeenCalledWith('wp-100');

			// Campaign content should have virtualKey removed
			expect(mockCampaign.content.items[virtualKey]).toBeUndefined();
			expect(mockCampaign.content.externalIds['wp-100']).toBeUndefined();
			expect(mockCampaign.content.items['exc-uuid-1'].syncs[configId].externalId).toBe('wp-101');
		});
	});
});
