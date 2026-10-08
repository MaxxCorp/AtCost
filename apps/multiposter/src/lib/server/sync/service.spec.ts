
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncService } from './service';
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
				startDateTime: new Date('2026-10-01T10:00:00.000Z'),
				endDateTime: new Date('2026-10-01T11:00:00.000Z'),
				recurrence: ['RRULE:FREQ=DAILY;COUNT=3'],
				status: 'confirmed'
			};

			const occIds = await service.getMasterOccurrenceIds(masterEvent);
			expect(occIds).toHaveLength(3);
			expect(occIds[0]).toBe('master-uuid');
			expect(occIds[1]).toContain('master-uuid_inst_');
			expect(occIds[2]).toContain('master-uuid_inst_');
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
});


