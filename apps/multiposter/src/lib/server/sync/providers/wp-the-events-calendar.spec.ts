import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WpTheEventsCalendarProvider } from './wp-the-events-calendar';
import type { SyncConfig } from '../types';

describe('WpTheEventsCalendarProvider', () => {
	let provider: WpTheEventsCalendarProvider;
	const mockConfig: SyncConfig = {
		id: 'cfg-wp-1',
		userId: 'usr-1',
		providerId: 'wp-account',
		providerType: 'wp-the-events-calendar',
		direction: 'push',
		enabled: true,
		settings: {
			baseUrl: 'https://example.com',
			username: 'admin',
			applicationPassword: 'app-password'
		},
		createdAt: new Date(),
		updatedAt: new Date()
	};

	beforeEach(() => {
		vi.clearAllMocks();
		provider = new WpTheEventsCalendarProvider();
		(provider as any).config = mockConfig;
		(provider as any).baseUrl = 'https://example.com';
		(provider as any).username = 'admin';
		(provider as any).applicationPassword = 'app-password';
	});

	describe('deleteEvent', () => {
		it('should call DELETE /tribe/events/v1/events/:id with force=true', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: vi.fn().mockResolvedValue({ deleted: true })
			});
			global.fetch = mockFetch;

			await provider.deleteEvent('12345');

			expect(mockFetch).toHaveBeenCalledTimes(1);
			const [url, opts] = mockFetch.mock.calls[0];
			expect(decodeURIComponent(url)).toContain('/tribe/events/v1/events/12345');
			expect(url).toContain('force=true');
			expect(opts.method).toBe('DELETE');
			expect(opts.headers.Authorization).toBeDefined();
		});

		it('should handle 404 cleanly when the event was already deleted on WordPress', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 404,
				statusText: 'Not Found',
				text: vi.fn().mockResolvedValue('Event not found')
			});
			global.fetch = mockFetch;

			await expect(provider.deleteEvent('12345')).resolves.toBeUndefined();
		});

		it('should throw error when WordPress returns a 500 server error', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
				text: vi.fn().mockResolvedValue('Database error')
			});
			global.fetch = mockFetch;

			await expect(provider.deleteEvent('12345')).rejects.toThrow(/WordPress API error: 500/);
		});
	});

	describe('description handling and invisible string fallback', () => {
		it('should use invisible string (\\u200B) when description is missing or empty', () => {
			const format = (provider as any).mapEventToWpFormat.bind(provider);

			const withUndefined = format({
				externalId: '',
				providerId: 'wp-the-events-calendar',
				summary: 'Test Event'
			});
			expect(withUndefined.description).toBe('\u200B');

			const withEmpty = format({
				externalId: '',
				providerId: 'wp-the-events-calendar',
				summary: 'Test Event',
				description: ''
			});
			expect(withEmpty.description).toBe('\u200B');

			const withWhitespace = format({
				externalId: '',
				providerId: 'wp-the-events-calendar',
				summary: 'Test Event',
				description: '   \n\t  '
			});
			expect(withWhitespace.description).toBe('\u200B');

			const withEmptyHtml = format({
				externalId: '',
				providerId: 'wp-the-events-calendar',
				summary: 'Test Event',
				description: '<p></p>'
			});
			expect(withEmptyHtml.description).toBe('\u200B');

			const withEmptyHtmlBreak = format({
				externalId: '',
				providerId: 'wp-the-events-calendar',
				summary: 'Test Event',
				description: '<p><br></p>'
			});
			expect(withEmptyHtmlBreak.description).toBe('\u200B');

			const withNbspOnly = format({
				externalId: '',
				providerId: 'wp-the-events-calendar',
				summary: 'Test Event',
				description: '<p>&nbsp;</p>'
			});
			expect(withNbspOnly.description).toBe('\u200B');
		});

		it('should keep description when meaningful content is present', () => {
			const format = (provider as any).mapEventToWpFormat.bind(provider);

			const withText = format({
				externalId: '',
				providerId: 'wp-the-events-calendar',
				summary: 'Test Event',
				description: 'A great concert'
			});
			expect(withText.description).toBe('A great concert');

			const withHtmlText = format({
				externalId: '',
				providerId: 'wp-the-events-calendar',
				summary: 'Test Event',
				description: '<p>A great concert</p>'
			});
			expect(withHtmlText.description).toBe('<p>A great concert</p>');

			const withMediaOnly = format({
				externalId: '',
				providerId: 'wp-the-events-calendar',
				summary: 'Test Event',
				description: '<p><img src="https://example.com/poster.jpg" /></p>'
			});
			expect(withMediaOnly.description).toBe('<p><img src="https://example.com/poster.jpg" /></p>');
		});

		it('should push event with invisible string in description when description is empty', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 201,
				json: vi.fn().mockResolvedValue({ id: 999, modified_gmt: '2026-10-01T12:00:00Z' })
			});
			global.fetch = mockFetch;

			const result = await provider.pushEvent({
				externalId: '',
				providerId: 'wp-the-events-calendar',
				summary: 'Event without description',
				description: '',
				startDateTime: new Date('2026-10-01T10:00:00Z'),
				endDateTime: new Date('2026-10-01T12:00:00Z')
			});

			expect(result.externalId).toBe('999');
			expect(mockFetch).toHaveBeenCalled();
			const postCall = mockFetch.mock.calls.find((call) => call[1]?.method === 'POST');
			expect(postCall).toBeDefined();
			const body = JSON.parse(postCall![1].body);
			expect(body.description).toBe('\u200B');
		});
	});
});
