import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MicrosoftCalendarProvider } from './microsoft-calendar';
import type { ExternalEvent, SyncConfig } from '../types';

describe('MicrosoftCalendarProvider', () => {
	let provider: MicrosoftCalendarProvider;
	const mockConfig: SyncConfig = {
		id: 'cfg-ms-1',
		userId: 'usr-1',
		providerId: 'microsoft-account',
		providerType: 'microsoft-calendar',
		direction: 'bidirectional',
		enabled: true,
		createdAt: new Date(),
		updatedAt: new Date()
	};

	beforeEach(() => {
		vi.clearAllMocks();
		provider = new MicrosoftCalendarProvider();
		// Mock initialized state directly for testing helper methods
		(provider as any).config = mockConfig;
		(provider as any).accessToken = 'mock-access-token';
		(provider as any).calendarId = 'primary';
	});

	describe('mapToMicrosoftEvent', () => {
		it('should set showAs to free and add [Cancelled] prefix for cancelled events', () => {
			const event: ExternalEvent = {
				externalId: 'ext-1',
				providerId: 'microsoft-calendar',
				summary: 'Sprint Planning',
				status: 'cancelled',
				isAllDay: false,
				startDateTime: new Date('2026-09-01T10:00:00Z'),
				endDateTime: new Date('2026-09-01T11:00:00Z')
			};

			const mapped = (provider as any).mapToMicrosoftEvent(event);

			expect(mapped.showAs).toBe('free');
			expect(mapped.subject).toBe('[Cancelled] Sprint Planning');
		});

		it('should not duplicate [Cancelled] prefix if already present', () => {
			const event: ExternalEvent = {
				externalId: 'ext-1',
				providerId: 'microsoft-calendar',
				summary: '[Cancelled] Sprint Planning',
				status: 'cancelled'
			};

			const mapped = (provider as any).mapToMicrosoftEvent(event);

			expect(mapped.subject).toBe('[Cancelled] Sprint Planning');
		});

		it('should not duplicate [Abgesagt] prefix if already present', () => {
			const event: ExternalEvent = {
				externalId: 'ext-1',
				providerId: 'microsoft-calendar',
				summary: '[Abgesagt] Sprint Planning',
				status: 'cancelled'
			};

			const mapped = (provider as any).mapToMicrosoftEvent(event);

			expect(mapped.subject).toBe('[Abgesagt] Sprint Planning');
		});

		it('should set showAs to tentative for tentative events', () => {
			const event: ExternalEvent = {
				externalId: 'ext-2',
				providerId: 'microsoft-calendar',
				summary: 'Brainstorming Session',
				status: 'tentative'
			};

			const mapped = (provider as any).mapToMicrosoftEvent(event);

			expect(mapped.showAs).toBe('tentative');
			expect(mapped.subject).toBe('Brainstorming Session');
		});

		it('should set showAs to busy for confirmed events', () => {
			const event: ExternalEvent = {
				externalId: 'ext-3',
				providerId: 'microsoft-calendar',
				summary: 'Client Workshop',
				status: 'confirmed'
			};

			const mapped = (provider as any).mapToMicrosoftEvent(event);

			expect(mapped.showAs).toBe('busy');
			expect(mapped.subject).toBe('Client Workshop');
		});

		it('should always populate start and end dates even if endDateTime is missing', () => {
			const start = new Date('2026-09-01T10:00:00Z');
			const event: ExternalEvent = {
				externalId: 'ext-4',
				providerId: 'microsoft-calendar',
				summary: 'Solo Focus Time',
				status: 'confirmed',
				startDateTime: start,
				endDateTime: undefined,
				metadata: { app_event_id: 'internal-id-123' }
			};

			const mapped = (provider as any).mapToMicrosoftEvent(event);

			expect(mapped.start).toBeDefined();
			expect(mapped.start.dateTime).toBeDefined();
			expect(mapped.end).toBeDefined();
			expect(mapped.end.dateTime).toBeDefined();
			expect(mapped.transactionId).toBe('internal-id-123');
		});
	});

	describe('updateEvent', () => {
		it('should attempt POST /cancel when event status is cancelled', async () => {
			const event: ExternalEvent = {
				externalId: 'ext-ms-event',
				providerId: 'microsoft-calendar',
				summary: 'Weekly Standup',
				status: 'cancelled'
			};

			const makeRequestMock = vi.fn().mockResolvedValue({});
			(provider as any).makeRequest = makeRequestMock;

			await provider.updateEvent('ext-ms-event', event);

			expect(makeRequestMock).toHaveBeenCalledWith(
				'https://graph.microsoft.com/v1.0/me/calendar/events/ext-ms-event/cancel',
				{
					method: 'POST',
					body: JSON.stringify({ comment: 'Event cancelled' })
				}
			);
		});

		it('should fall back to PATCH with showAs: free if POST /cancel throws an error', async () => {
			const event: ExternalEvent = {
				externalId: 'ext-single-appointment',
				providerId: 'microsoft-calendar',
				summary: 'Solo Focus Time',
				status: 'cancelled'
			};

			const makeRequestMock = vi
				.fn()
				.mockRejectedValueOnce(new Error('Cannot cancel non-meeting'))
				.mockResolvedValueOnce({ id: 'ext-single-appointment', '@odata.etag': 'W/"etag"' });

			(provider as any).makeRequest = makeRequestMock;

			const result = await provider.updateEvent('ext-single-appointment', event);

			// First call was POST /cancel
			expect(makeRequestMock).toHaveBeenNthCalledWith(
				1,
				'https://graph.microsoft.com/v1.0/me/calendar/events/ext-single-appointment/cancel',
				expect.objectContaining({ method: 'POST' })
			);

			// Second call was fallback PATCH
			expect(makeRequestMock).toHaveBeenNthCalledWith(
				2,
				'https://graph.microsoft.com/v1.0/me/calendar/events/ext-single-appointment',
				expect.objectContaining({
					method: 'PATCH',
					body: expect.stringContaining('"showAs":"free"')
				})
			);

			expect(result.etag).toBe('W/"etag"');
		});

		it('should perform PATCH for confirmed events', async () => {
			const event: ExternalEvent = {
				externalId: 'ext-confirmed',
				providerId: 'microsoft-calendar',
				summary: 'Design Review',
				status: 'confirmed'
			};

			const makeRequestMock = vi.fn().mockResolvedValue({ '@odata.etag': 'etag-confirmed' });
			(provider as any).makeRequest = makeRequestMock;

			const result = await provider.updateEvent('ext-confirmed', event);

			expect(makeRequestMock).toHaveBeenCalledTimes(1);
			expect(makeRequestMock).toHaveBeenCalledWith(
				'https://graph.microsoft.com/v1.0/me/calendar/events/ext-confirmed',
				expect.objectContaining({
					method: 'PATCH',
					body: expect.stringContaining('"showAs":"busy"')
				})
			);
			expect(result.etag).toBe('etag-confirmed');
		});
	});

	describe('deleteEvent', () => {
		it('should attempt POST /cancel to free up room mailboxes and then DELETE the event', async () => {
			const makeRequestMock = vi.fn().mockResolvedValue({});
			(provider as any).makeRequest = makeRequestMock;

			await provider.deleteEvent('ext-meeting-room');

			expect(makeRequestMock).toHaveBeenNthCalledWith(
				1,
				'https://graph.microsoft.com/v1.0/me/calendar/events/ext-meeting-room/cancel',
				expect.objectContaining({ method: 'POST' })
			);
			expect(makeRequestMock).toHaveBeenNthCalledWith(
				2,
				'https://graph.microsoft.com/v1.0/me/calendar/events/ext-meeting-room',
				expect.objectContaining({ method: 'DELETE' })
			);
		});

		it('should still execute DELETE if POST /cancel fails (e.g. non-meeting event)', async () => {
			const makeRequestMock = vi
				.fn()
				.mockRejectedValueOnce(new Error('Cannot cancel non-meeting'))
				.mockResolvedValueOnce({});
			(provider as any).makeRequest = makeRequestMock;

			await provider.deleteEvent('ext-non-meeting');

			expect(makeRequestMock).toHaveBeenCalledTimes(2);
			expect(makeRequestMock).toHaveBeenNthCalledWith(
				2,
				'https://graph.microsoft.com/v1.0/me/calendar/events/ext-non-meeting',
				expect.objectContaining({ method: 'DELETE' })
			);
		});

		it('should not throw if DELETE returns 404/ResourceNotFound (already deleted)', async () => {
			const makeRequestMock = vi
				.fn()
				.mockRejectedValueOnce(new Error('ResourceNotFound 404'))
				.mockRejectedValueOnce(new Error('ResourceNotFound: 404'));
			(provider as any).makeRequest = makeRequestMock;

			await expect(provider.deleteEvent('ext-already-deleted')).resolves.toBeUndefined();
		});
	});

	describe('recurrence mapping', () => {
		it('should map weekly RRULE to Microsoft Graph patternedRecurrence with noEnd', () => {
			const event: ExternalEvent = {
				externalId: 'ext-rec-1',
				providerId: 'microsoft-calendar',
				summary: 'Weekly Team Sync',
				status: 'confirmed',
				startDateTime: new Date('2026-10-05T09:00:00Z'),
				endDateTime: new Date('2026-10-05T10:00:00Z'),
				startTimeZone: 'UTC',
				recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR']
			};

			const mapped = (provider as any).mapToMicrosoftEvent(event);

			expect(mapped.recurrence).toBeDefined();
			expect(mapped.recurrence.pattern).toEqual({
				type: 'weekly',
				interval: 1,
				daysOfWeek: ['monday', 'wednesday', 'friday'],
				firstDayOfWeek: 'sunday'
			});
			expect(mapped.recurrence.range).toEqual({
				type: 'noEnd',
				startDate: '2026-10-05',
				recurrenceTimeZone: 'UTC'
			});
		});

		it('should map weekly RRULE with interval and UNTIL date to endDate range', () => {
			const event: ExternalEvent = {
				externalId: 'ext-rec-2',
				providerId: 'microsoft-calendar',
				summary: 'Bi-weekly Sprint Review',
				status: 'confirmed',
				startDateTime: new Date('2026-10-06T14:00:00Z'),
				endDateTime: new Date('2026-10-06T15:00:00Z'),
				startTimeZone: 'UTC',
				recurrence: ['RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU;UNTIL=20261231T235959Z']
			};

			const mapped = (provider as any).mapToMicrosoftEvent(event);

			expect(mapped.recurrence).toBeDefined();
			expect(mapped.recurrence.pattern.type).toBe('weekly');
			expect(mapped.recurrence.pattern.interval).toBe(2);
			expect(mapped.recurrence.pattern.daysOfWeek).toEqual(['tuesday']);
			expect(mapped.recurrence.range.type).toBe('endDate');
			expect(mapped.recurrence.range.startDate).toBe('2026-10-06');
			expect(mapped.recurrence.range.endDate).toBe('2026-12-31');
		});

		it('should map daily RRULE with COUNT to numbered range', () => {
			const event: ExternalEvent = {
				externalId: 'ext-rec-3',
				providerId: 'microsoft-calendar',
				summary: 'Daily Standup',
				status: 'confirmed',
				startDateTime: new Date('2026-10-01T08:00:00Z'),
				endDateTime: new Date('2026-10-01T08:30:00Z'),
				startTimeZone: 'UTC',
				recurrence: ['RRULE:FREQ=DAILY;COUNT=10']
			};

			const mapped = (provider as any).mapToMicrosoftEvent(event);

			expect(mapped.recurrence).toBeDefined();
			expect(mapped.recurrence.pattern).toEqual({
				type: 'daily',
				interval: 1
			});
			expect(mapped.recurrence.range).toEqual({
				type: 'numbered',
				numberOfOccurrences: 10,
				startDate: '2026-10-01',
				recurrenceTimeZone: 'UTC'
			});
		});

		it('should map absolute monthly RRULE to absoluteMonthly pattern', () => {
			const event: ExternalEvent = {
				externalId: 'ext-rec-4',
				providerId: 'microsoft-calendar',
				summary: 'Monthly Retrospective',
				status: 'confirmed',
				startDateTime: new Date('2026-10-15T16:00:00Z'),
				startTimeZone: 'UTC',
				recurrence: ['RRULE:FREQ=MONTHLY;BYMONTHDAY=15']
			};

			const mapped = (provider as any).mapToMicrosoftEvent(event);

			expect(mapped.recurrence).toBeDefined();
			expect(mapped.recurrence.pattern).toEqual({
				type: 'absoluteMonthly',
				interval: 1,
				dayOfMonth: 15
			});
			expect(mapped.recurrence.range.type).toBe('noEnd');
		});

		it('should map relative monthly RRULE (e.g. 2nd Monday) to relativeMonthly pattern', () => {
			const event: ExternalEvent = {
				externalId: 'ext-rec-5',
				providerId: 'microsoft-calendar',
				summary: 'All Hands',
				status: 'confirmed',
				startDateTime: new Date('2026-10-12T10:00:00Z'),
				startTimeZone: 'UTC',
				recurrence: ['RRULE:FREQ=MONTHLY;BYDAY=2MO']
			};

			const mapped = (provider as any).mapToMicrosoftEvent(event);

			expect(mapped.recurrence).toBeDefined();
			expect(mapped.recurrence.pattern).toEqual({
				type: 'relativeMonthly',
				interval: 1,
				daysOfWeek: ['monday'],
				index: 'second'
			});
		});

		it('should map relative monthly with negative index (e.g. last Sunday) to last index', () => {
			const event: ExternalEvent = {
				externalId: 'ext-rec-6',
				providerId: 'microsoft-calendar',
				summary: 'Community Meetup',
				status: 'confirmed',
				startDateTime: new Date('2026-10-25T11:00:00Z'),
				startTimeZone: 'UTC',
				recurrence: ['RRULE:FREQ=MONTHLY;BYDAY=-1SU']
			};

			const mapped = (provider as any).mapToMicrosoftEvent(event);

			expect(mapped.recurrence).toBeDefined();
			expect(mapped.recurrence.pattern).toEqual({
				type: 'relativeMonthly',
				interval: 1,
				daysOfWeek: ['sunday'],
				index: 'last'
			});
		});

		it('should set recurrence to null when recurrence is an empty array', () => {
			const event: ExternalEvent = {
				externalId: 'ext-rec-7',
				providerId: 'microsoft-calendar',
				summary: 'Demoted Series',
				status: 'confirmed',
				startDateTime: new Date('2026-10-01T10:00:00Z'),
				recurrence: []
			};

			const mapped = (provider as any).mapToMicrosoftEvent(event);

			expect(mapped.recurrence).toBeNull();
		});

		it('should leave recurrence undefined when recurrence is undefined', () => {
			const event: ExternalEvent = {
				externalId: 'ext-rec-8',
				providerId: 'microsoft-calendar',
				summary: 'Single Event',
				status: 'confirmed',
				startDateTime: new Date('2026-10-01T10:00:00Z')
			};

			const mapped = (provider as any).mapToMicrosoftEvent(event);

			expect(mapped.recurrence).toBeUndefined();
		});

		it('should include recurrence payload when calling pushEvent for a recurring event', async () => {
			const event: ExternalEvent = {
				externalId: 'ext-series-master',
				providerId: 'microsoft-calendar',
				summary: 'Recurring Workshop',
				status: 'confirmed',
				startDateTime: new Date('2026-10-07T13:00:00Z'),
				endDateTime: new Date('2026-10-07T14:00:00Z'),
				startTimeZone: 'UTC',
				recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=WE']
			};

			const makeRequestMock = vi.fn().mockResolvedValue({ id: 'graph-ms-id-123', '@odata.etag': 'W/"rec-etag"' });
			(provider as any).makeRequest = makeRequestMock;

			const result = await provider.pushEvent(event);

			expect(result.externalId).toBe('graph-ms-id-123');
			expect(makeRequestMock).toHaveBeenCalledWith(
				'https://graph.microsoft.com/v1.0/me/calendar/events',
				expect.objectContaining({
					method: 'POST',
					body: expect.stringContaining('"recurrence":{')
				})
			);

			const parsedBody = JSON.parse(makeRequestMock.mock.calls[0][1].body);
			expect(parsedBody.recurrence.pattern.type).toBe('weekly');
			expect(parsedBody.recurrence.pattern.daysOfWeek).toEqual(['wednesday']);
		});

		it('should include recurrence in mapToExternalEvent when msEvent has recurrence object', () => {
			const msEvent = {
				id: 'ms-rec-event-1',
				subject: 'Weekly Design Review',
				showAs: 'busy',
				start: { dateTime: '2026-10-05T10:00:00', timeZone: 'UTC' },
				end: { dateTime: '2026-10-05T11:00:00', timeZone: 'UTC' },
				recurrence: {
					pattern: {
						type: 'weekly',
						interval: 1,
						daysOfWeek: ['monday', 'friday'],
						firstDayOfWeek: 'sunday'
					},
					range: {
						type: 'endDate',
						startDate: '2026-10-05',
						endDate: '2026-12-31'
					}
				}
			};

			const external = (provider as any).mapToExternalEvent(msEvent);

			expect(external.recurrence).toBeDefined();
			expect(external.recurrence).toHaveLength(1);
			expect(external.recurrence![0]).toContain('FREQ=WEEKLY');
			expect(external.recurrence![0]).toContain('BYDAY=MO,FR');
			expect(external.recurrence![0]).toContain('UNTIL=20261231T235959Z');
		});
	});

	describe('validateCalendarAccess and validateConnection', () => {
		it('should succeed when GET on primary calendar succeeds', async () => {
			(provider as any).calendarId = 'primary';
			const makeRequestMock = vi.fn().mockResolvedValueOnce({ id: 'primary-cal' });
			(provider as any).makeRequest = makeRequestMock;

			await expect(provider.validateCalendarAccess()).resolves.toBeUndefined();
			expect(makeRequestMock).toHaveBeenCalledWith(
				'https://graph.microsoft.com/v1.0/me/calendar',
				{ method: 'GET' }
			);
		});

		it('should succeed when GET on specific calendar ID succeeds', async () => {
			(provider as any).calendarId = 'custom-cal-123';
			const makeRequestMock = vi.fn().mockResolvedValueOnce({ id: 'custom-cal-123' });
			(provider as any).makeRequest = makeRequestMock;

			await expect(provider.validateCalendarAccess()).resolves.toBeUndefined();
			expect(makeRequestMock).toHaveBeenCalledWith(
				'https://graph.microsoft.com/v1.0/me/calendars/custom-cal-123',
				{ method: 'GET' }
			);
		});

		it('should succeed when GET on user email calendar succeeds', async () => {
			(provider as any).calendarId = 'colleague@example.com';
			const makeRequestMock = vi.fn().mockResolvedValueOnce({ id: 'cal-colleague' });
			(provider as any).makeRequest = makeRequestMock;

			await expect(provider.validateCalendarAccess()).resolves.toBeUndefined();
			expect(makeRequestMock).toHaveBeenCalledWith(
				'https://graph.microsoft.com/v1.0/users/colleague%40example.com/calendar',
				{ method: 'GET' }
			);
		});

		it('should throw explicit error and fail without fallback when primary calendar is unavailable', async () => {
			(provider as any).calendarId = 'primary';
			const makeRequestMock = vi.fn().mockRejectedValueOnce(new Error('ResourceNotFound: 404'));
			(provider as any).makeRequest = makeRequestMock;

			await expect(provider.validateCalendarAccess()).rejects.toThrow(
				'Microsoft Calendar sync failed: Specified primary calendar is not available or accessible (ResourceNotFound: 404).'
			);
		});

		it('should throw explicit error and fail without fallback when custom calendar is unavailable', async () => {
			(provider as any).calendarId = 'deleted-cal';
			const makeRequestMock = vi.fn().mockRejectedValueOnce(new Error('AccessDenied: 403'));
			(provider as any).makeRequest = makeRequestMock;

			await expect(provider.validateCalendarAccess()).rejects.toThrow(
				'Microsoft Calendar sync failed: Specified calendar "deleted-cal" is not available or accessible (AccessDenied: 403).'
			);
		});

		it('should throw if provider is not initialized', async () => {
			(provider as any).accessToken = undefined;
			await expect(provider.validateCalendarAccess()).rejects.toThrow('Provider not initialized');
		});

		it('should return true from validateConnection when validateCalendarAccess succeeds', async () => {
			vi.spyOn(provider, 'validateCalendarAccess').mockResolvedValueOnce();
			expect(await provider.validateConnection()).toBe(true);
		});

		it('should return false from validateConnection when validateCalendarAccess fails', async () => {
			vi.spyOn(provider, 'validateCalendarAccess').mockRejectedValueOnce(new Error('Calendar not found'));
			expect(await provider.validateConnection()).toBe(false);
		});
	});

	describe('pullEvents calendar validation', () => {
		it('should validate calendar access before pulling when syncToken is undefined', async () => {
			const validateSpy = vi.spyOn(provider, 'validateCalendarAccess').mockResolvedValueOnce();
			const makeRequestMock = vi.fn().mockResolvedValueOnce({ value: [] });
			(provider as any).makeRequest = makeRequestMock;

			const result = await provider.pullEvents();

			expect(validateSpy).toHaveBeenCalledTimes(1);
			expect(result.events).toEqual([]);
		});

		it('should throw error and abort pull if validateCalendarAccess fails on initial pull', async () => {
			vi.spyOn(provider, 'validateCalendarAccess').mockRejectedValueOnce(
				new Error('Microsoft Calendar sync failed: Specified primary calendar is not available or accessible')
			);
			const makeRequestMock = vi.fn();
			(provider as any).makeRequest = makeRequestMock;

			await expect(provider.pullEvents()).rejects.toThrow(
				'Microsoft Calendar sync failed: Specified primary calendar is not available or accessible'
			);
			expect(makeRequestMock).not.toHaveBeenCalled();
		});

		it('should not call validateCalendarAccess when syncToken is provided', async () => {
			const validateSpy = vi.spyOn(provider, 'validateCalendarAccess');
			const makeRequestMock = vi.fn().mockResolvedValueOnce({ value: [] });
			(provider as any).makeRequest = makeRequestMock;

			await provider.pullEvents('delta-token-123');

			expect(validateSpy).not.toHaveBeenCalled();
		});
	});
});
