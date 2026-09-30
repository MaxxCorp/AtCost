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
});
