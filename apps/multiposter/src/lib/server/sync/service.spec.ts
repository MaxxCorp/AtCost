
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncService } from './service';
import { db } from '@ac/db';
import { syncMapping as syncMappingTable, event as eventTable } from '@ac/db';
import { eq, and } from '@ac/db';

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
vi.mock('../contact-resolution', () => ({
	resolveEventContact: vi.fn().mockResolvedValue(null)
}));

// Mock contacts
vi.mock('../contacts', () => ({
	getEntityContacts: vi.fn().mockResolvedValue([])
}));

describe('SyncService - processExternalEvent deduplication', () => {
	let service: SyncService;
	const mockConfig = { id: 'config-1', userId: 'user-1', providerId: 'provider-1' } as any;

	beforeEach(() => {
		vi.clearAllMocks();
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

		// 1. Mock mapping check (no mapping found)
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

		// 3. Mock idempotent mapping insertion
		(db.insert as any).mockReturnValueOnce({
			values: vi.fn().mockReturnValueOnce({
				onConflictDoUpdate: vi.fn().mockResolvedValueOnce({})
			})
		});

		// @ts-ignore - accessing private method for testing
		await service.processExternalEvent(mockConfig, externalEvent);

		// Verify it tried to fetch the event by UUID
		expect(db.select).toHaveBeenCalled();
		
		// Verify mapping was healed/created
		expect(db.insert).toHaveBeenCalledWith(syncMappingTable);
	});

	it('should handle partial updates and NOT overwrite existing fields with null/undefined', async () => {
		const eventId = 'event-123';
		const externalEvent = {
			externalId: 'ext-123',
			summary: 'Updated Summary',
			// description: undefined, // Missing field
			status: 'confirmed'
		} as any;

		// 1. Mock mapping exists
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

		// Mock mapping exists
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

		// Verify syncMappingTable was updated with etag
		expect(db.update).toHaveBeenCalledWith(syncMappingTable);
		const mappingUpdateSet = (db.update(syncMappingTable).set as any).mock.calls[1][0];
		expect(mappingUpdateSet.etag).toBe('etag-123');

		// Verify eventTable was NOT deleted
		expect(db.delete).not.toHaveBeenCalledWith(eventTable);
	});
});

describe('SyncService - mapInternalToExternal status mapping', () => {
	let service: SyncService;

	beforeEach(() => {
		vi.clearAllMocks();
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
});

