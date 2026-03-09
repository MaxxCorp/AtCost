
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncService } from './service';
import { db } from '../db';
import { syncMapping as syncMappingTable, event as eventTable } from '../db/schema';
import { eq, and } from 'drizzle-orm';

// Mock the database
vi.mock('../db', () => ({
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
}));

// Mock the realtime publisher
vi.mock('../realtime', () => ({
	publishEventChange: vi.fn().mockResolvedValue(undefined)
}));

// Mock contact resolution
vi.mock('../contact-resolution', () => ({
	resolveEventContact: vi.fn().mockResolvedValue(null)
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
		expect((db as any).where).toHaveBeenCalledWith(eq(eventTable.id, internalUuid));
		
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
});
