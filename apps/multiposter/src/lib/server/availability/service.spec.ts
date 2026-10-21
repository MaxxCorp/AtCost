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

vi.mock('$app/env/private', () => ({
    MICROSOFT_TENANT_ID: 'mock-tenant-id',
    MICROSOFT_CLIENT_ID: 'mock-client-id',
    MICROSOFT_CLIENT_SECRET: 'mock-client-secret'
}));

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

    it('should not flag conflict when checking availability for an instance of the recurring series itself', async () => {
        // Occurrence for 2026-09-08 is being edited by the instance itself
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

        // Query occurrence for 2026-09-08 with currentEventId being that virtual instance
        const result = await service.checkAvailability({
            currentEventId: 'series-event-1_inst_2026-09-08T10:00:00.000Z',
            startDateTime: new Date('2026-09-08T10:00:00Z'),
            endDateTime: new Date('2026-09-08T11:00:00Z'),
            resources: [{ id: 'room-1', allocationCalendars: [] }],
            contacts: []
        });

        expect(result.resourceAvailability['room-1']).toBeDefined();
        // Since this occurrence is the instance being edited, it must NOT collide with itself!
        expect(result.resourceAvailability['room-1'].available).toBe(true);
    });

    it('should not flag conflict when an external busy entry in Microsoft 365 belongs to the event being edited', async () => {
        const currentEventId = 'e4f61f77-85ef-4a11-b06d-74d1264c4897';
        const mockCurrentBooking = [{
            eventId: currentEventId,
            resourceId: 'room-1',
            summary: 'Yoga für Senioren',
            startDateTime: new Date('2026-09-08T10:00:00Z'),
            endDateTime: new Date('2026-09-08T11:30:00Z'),
            recurrence: null,
            seriesId: null,
            exdates: [],
            startTimeZone: 'UTC'
        }];

        const mockWhere = vi.fn()
            .mockResolvedValueOnce(mockCurrentBooking)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);
        const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
        const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
        (db.select as any).mockReturnValue({ from: mockFrom });

        const mockProvider = {
            name: 'microsoft',
            checkSchedule: vi.fn().mockResolvedValue(new Map([
                ['room1@example.com', {
                    available: false,
                    reason: 'Busy in Microsoft 365: "Veranstaltung BHS "',
                    eventTitle: 'Veranstaltung BHS ',
                    scheduleItems: [{
                        status: 'busy',
                        subject: 'Veranstaltung BHS ',
                        start: new Date('2026-09-08T10:00:00Z'),
                        end: new Date('2026-09-08T11:30:00Z')
                    }]
                }]
            ]))
        };
        (service as any).providers = [mockProvider];

        const result = await service.checkAvailability({
            currentEventId,
            startDateTime: new Date('2026-09-08T10:00:00Z'),
            endDateTime: new Date('2026-09-08T11:30:00Z'),
            resources: [{ id: 'room-1', allocationCalendars: [{ email: 'room1@example.com' }] }],
            contacts: []
        });

        expect(result.resourceAvailability['room-1']).toBeDefined();
        expect(result.resourceAvailability['room-1'].available).toBe(true);
    });

    it('should correlate external busy status with local occupant event when another event is being checked', async () => {
        const mockLocalOccupant = [{
            eventId: 'yoga-event-1',
            eventTitle: 'Yoga für Senioren'
        }];

        const mockWhere = vi.fn()
            .mockResolvedValueOnce([]) // local non-recurring collision check
            .mockResolvedValueOnce([]) // local recurring events check
            .mockResolvedValueOnce(mockLocalOccupant); // external correlation check
        const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
        const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
        (db.select as any).mockReturnValue({ from: mockFrom });

        const mockProvider = {
            name: 'microsoft',
            checkSchedule: vi.fn().mockResolvedValue(new Map([
                ['room1@example.com', {
                    available: false,
                    reason: 'Busy in Microsoft 365: "Veranstaltung BHS "',
                    eventTitle: 'Veranstaltung BHS ',
                    scheduleItems: [{
                        status: 'busy',
                        subject: 'Veranstaltung BHS ',
                        start: new Date('2026-09-08T10:00:00Z'),
                        end: new Date('2026-09-08T11:30:00Z')
                    }]
                }]
            ]))
        };
        (service as any).providers = [mockProvider];

        const result = await service.checkAvailability({
            currentEventId: 'other-event-id',
            startDateTime: new Date('2026-09-08T10:00:00Z'),
            endDateTime: new Date('2026-09-08T11:30:00Z'),
            resources: [{ id: 'room-1', allocationCalendars: [{ email: 'room1@example.com' }] }],
            contacts: []
        });

        expect(result.resourceAvailability['room-1']).toBeDefined();
        expect(result.resourceAvailability['room-1'].available).toBe(false);
        expect(result.resourceAvailability['room-1'].eventId).toBe('yoga-event-1');
        expect(result.resourceAvailability['room-1'].eventTitle).toBe('Yoga für Senioren');
        expect(result.resourceAvailability['room-1'].reason).toBe('Booked in "Yoga für Senioren"');
    });

    it('MicrosoftAvailabilityProvider should not consider adjacent scheduleItem ending at startDateTime as busy', async () => {
        const { MicrosoftAvailabilityProvider } = await import('./service');
        const provider = new MicrosoftAvailabilityProvider();
        const start = new Date('2026-09-08T10:00:00Z');
        const end = new Date('2026-09-08T11:30:00Z');

        // Mock fetch response for Graph getSchedule
        const mockFetch = vi.fn().mockImplementation(async (url: string) => {
            if (url.includes('oauth2/v2.0/token')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ access_token: 'mock-access-token' })
                };
            }
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    value: [{
                        scheduleId: 'room1@example.com',
                        availabilityView: '2',
                        scheduleItems: [{
                            status: 'busy',
                            subject: 'Preceding Event',
                            start: { dateTime: '2026-09-08T09:00:00', timeZone: 'UTC' },
                            end: { dateTime: '2026-09-08T10:00:00', timeZone: 'UTC' }
                        }]
                    }]
                })
            };
        });
        globalThis.fetch = mockFetch;

        const resMap = await provider.checkSchedule(
            ['room1@example.com'],
            start,
            end
        );

        const roomRes = resMap.get('room1@example.com');
        expect(roomRes).toBeDefined();
        expect(roomRes?.available).toBe(true);
    });
});

