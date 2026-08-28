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
});
