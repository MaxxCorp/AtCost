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

    it('should detect collision from recurring event occurrence for a room resource', async () => {
        // Query 1: non-recurring collisions (empty)
        // Query 2: recurring events (has 1 weekly recurring event starting in the past)
        const mockRecurringEvent = {
            resourceId: 'room-1',
            eventId: 'series-event-1',
            eventTitle: 'Weekly Team Standup',
            startDateTime: new Date('2026-09-01T10:00:00Z'),
            endDateTime: new Date('2026-09-01T11:00:00Z'),
            recurrence: ['RRULE:FREQ=WEEKLY;COUNT=10'],
            seriesId: null,
            exdates: [],
            startTimeZone: 'UTC'
        };

        const mockWhere1 = vi.fn().mockResolvedValue([]);
        const mockInnerJoin1 = vi.fn().mockReturnValue({ where: mockWhere1 });
        const mockFrom1 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin1 });

        const mockWhere2 = vi.fn().mockResolvedValue([mockRecurringEvent]);
        const mockInnerJoin2 = vi.fn().mockReturnValue({ where: mockWhere2 });
        const mockFrom2 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin2 });

        (db.select as any)
            .mockReturnValueOnce({ from: mockFrom1 })
            .mockReturnValueOnce({ from: mockFrom2 });

        // Query occurrence for next Tuesday: 2026-09-08
        const result = await service.checkAvailability({
            startDateTime: new Date('2026-09-08T10:00:00Z'),
            endDateTime: new Date('2026-09-08T11:00:00Z'),
            resources: [{ id: 'room-1', allocationCalendars: [] }],
            contacts: []
        });

        expect(result.resourceAvailability['room-1']).toBeDefined();
        expect(result.resourceAvailability['room-1'].available).toBe(false);
        expect(result.resourceAvailability['room-1'].eventId).toBe('series-event-1');
        expect(result.resourceAvailability['room-1'].eventTitle).toBe('Weekly Team Standup');
    });

    it('should free up room for occurrence when occurrence date is in exdates', async () => {
        // Occurrence for 2026-09-08 was deleted (placed in exdates)
        const mockRecurringEvent = {
            resourceId: 'room-1',
            eventId: 'series-event-1',
            eventTitle: 'Weekly Team Standup',
            startDateTime: new Date('2026-09-01T10:00:00Z'),
            endDateTime: new Date('2026-09-01T11:00:00Z'),
            recurrence: ['RRULE:FREQ=WEEKLY;COUNT=10'],
            seriesId: null,
            exdates: ['2026-09-08T10:00:00.000Z'],
            startTimeZone: 'UTC'
        };

        const mockWhere1 = vi.fn().mockResolvedValue([]);
        const mockInnerJoin1 = vi.fn().mockReturnValue({ where: mockWhere1 });
        const mockFrom1 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin1 });

        const mockWhere2 = vi.fn().mockResolvedValue([mockRecurringEvent]);
        const mockInnerJoin2 = vi.fn().mockReturnValue({ where: mockWhere2 });
        const mockFrom2 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin2 });

        (db.select as any)
            .mockReturnValueOnce({ from: mockFrom1 })
            .mockReturnValueOnce({ from: mockFrom2 });

        const result = await service.checkAvailability({
            startDateTime: new Date('2026-09-08T10:00:00Z'),
            endDateTime: new Date('2026-09-08T11:00:00Z'),
            resources: [{ id: 'room-1', allocationCalendars: [] }],
            contacts: []
        });

        expect(result.resourceAvailability['room-1']).toBeDefined();
        // Since 2026-09-08 is in exdates, it was deleted, so the room is free!
        expect(result.resourceAvailability['room-1'].available).toBe(true);
    });
});
