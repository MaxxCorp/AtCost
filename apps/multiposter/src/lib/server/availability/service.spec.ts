import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AvailabilityService } from './service';
import { db } from '@ac/db';

vi.mock('@ac/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@ac/db')>();
    return {
        ...actual,
        db: {
            select: vi.fn(),
            from: vi.fn(),
            innerJoin: vi.fn(),
            where: vi.fn(),
        }
    };
});

describe('AvailabilityService', () => {
    let service: AvailabilityService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new AvailabilityService();
    });

    it('should return eventId and eventTitle when a resource collides with a local event', async () => {
        const mockCollisions = [
            {
                resourceId: 'res-1',
                eventId: 'event-conflict-123',
                eventTitle: 'Annual General Meeting'
            }
        ];

        // Mock chain for db.select().from().innerJoin().where()
        const mockWhere = vi.fn().mockResolvedValue(mockCollisions);
        const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
        const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
        (db.select as any).mockReturnValue({ from: mockFrom });

        const result = await service.checkAvailability({
            startDateTime: new Date('2026-09-04T10:00:00Z'),
            endDateTime: new Date('2026-09-04T12:00:00Z'),
            resources: [{ id: 'res-1', allocationCalendars: [{ provider: 'microsoft-calendar', calendarId: 'room1@example.com' }] }],
            contacts: []
        });

        expect(result.resourceAvailability['res-1']).toBeDefined();
        expect(result.resourceAvailability['res-1'].available).toBe(false);
        expect(result.resourceAvailability['res-1'].eventId).toBe('event-conflict-123');
        expect(result.resourceAvailability['res-1'].eventTitle).toBe('Annual General Meeting');
        expect(result.resourceAvailability['res-1'].reason).toBe('Booked in "Annual General Meeting"');
    });

    it('should return available: true when there are no collisions', async () => {
        const mockWhere = vi.fn().mockResolvedValue([]);
        const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
        const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
        (db.select as any).mockReturnValue({ from: mockFrom });

        const result = await service.checkAvailability({
            startDateTime: new Date('2026-09-04T10:00:00Z'),
            endDateTime: new Date('2026-09-04T12:00:00Z'),
            resources: [{ id: 'res-free', allocationCalendars: [] }],
            contacts: []
        });

        expect(result.resourceAvailability['res-free']).toBeDefined();
        expect(result.resourceAvailability['res-free'].available).toBe(true);
        expect(result.resourceAvailability['res-free'].eventId).toBeUndefined();
    });
});
