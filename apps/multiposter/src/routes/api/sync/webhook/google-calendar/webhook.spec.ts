import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './+server';
import type { RequestEvent } from '@sveltejs/kit';

// Mock the sync service
vi.mock('$lib/server/sync/service', () => ({
	syncService: {
		handleWebhook: vi.fn().mockResolvedValue({ configId: 'test-config-id', processed: true })
	}
}));

describe('Google Calendar Webhook Handler', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	function createMockRequest(headers: Record<string, string>): RequestEvent {
		return {
			request: {
				headers: {
					get: (name: string) => headers[name] || null
				}
			}
		} as unknown as RequestEvent;
	}

	describe('POST handler', () => {
		it('should accept valid webhook notification with exists state', async () => {
			const event = createMockRequest({
				'X-Goog-Channel-ID': 'channel-123',
				'X-Goog-Resource-ID': 'resource-456',
				'X-Goog-Resource-State': 'exists',
				'X-Goog-Channel-Token': 'test-config-id'
			});

			const response = await POST(event);

			expect(response.status).toBe(200);
			const text = await response.text();
			expect(text).toBe('Webhook processed');
		});

		it('should accept valid webhook notification with not_exists state', async () => {
			const event = createMockRequest({
				'X-Goog-Channel-ID': 'channel-123',
				'X-Goog-Resource-ID': 'resource-456',
				'X-Goog-Resource-State': 'not_exists',
				'X-Goog-Channel-Token': 'test-config-id'
			});

			const response = await POST(event);

			expect(response.status).toBe(200);
			const text = await response.text();
			expect(text).toBe('Webhook processed');
		});

		it('should acknowledge sync state without processing', async () => {
			const event = createMockRequest({
				'X-Goog-Channel-ID': 'channel-123',
				'X-Goog-Resource-ID': 'resource-456',
				'X-Goog-Resource-State': 'sync',
				'X-Goog-Channel-Token': 'test-config-id'
			});

			const response = await POST(event);

			expect(response.status).toBe(200);
			const text = await response.text();
			expect(text).toBe('OK');
		});

		it('should reject webhook without channel token', async () => {
			const event = createMockRequest({
				'X-Goog-Channel-ID': 'channel-123',
				'X-Goog-Resource-ID': 'resource-456',
				'X-Goog-Resource-State': 'exists'
			});

			const response = await POST(event);

			expect(response.status).toBe(400);
			const text = await response.text();
			expect(text).toBe('Missing channel token');
		});

		it('should handle errors gracefully', async () => {
			const { syncService } = await import('$lib/server/sync/service');
			vi.mocked(syncService.handleWebhook).mockRejectedValueOnce(new Error('Database error'));

			// Suppress expected error logs for cleaner test output
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const event = createMockRequest({
				'X-Goog-Channel-ID': 'channel-123',
				'X-Goog-Resource-ID': 'resource-456',
				'X-Goog-Resource-State': 'exists',
				'X-Goog-Channel-Token': 'test-config-id'
			});

			const response = await POST(event);

			expect(response.status).toBe(500);
			const text = await response.text();
			expect(text).toBe('Internal server error');
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'Failed to handle Google Calendar webhook:',
				expect.any(Error)
			);

			consoleErrorSpy.mockRestore();
		});
	});

	describe('Google Calendar webhook payload examples', () => {
		it('should handle new event creation notification', async () => {
			// Simulate Google Calendar sending a notification about a new event
			const event = createMockRequest({
				'X-Goog-Channel-ID': 'channel-abc123',
				'X-Goog-Resource-ID': 'o3b9f5e5c0b9ab0c9b3e5a5c9f0e5d',
				'X-Goog-Resource-State': 'exists',
				'X-Goog-Channel-Token': 'sync-config-uuid-123',
				'X-Goog-Resource-URI': 'https://www.googleapis.com/calendar/v3/calendars/primary/events?alt=json',
				'X-Goog-Channel-Expiration': new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString()
			});

			const response = await POST(event);
			expect(response.status).toBe(200);
		});

		it('should handle event modification notification', async () => {
			// Simulate Google Calendar sending a notification about an updated event
			const event = createMockRequest({
				'X-Goog-Channel-ID': 'channel-abc123',
				'X-Goog-Resource-ID': 'o3b9f5e5c0b9ab0c9b3e5a5c9f0e5d',
				'X-Goog-Resource-State': 'exists',
				'X-Goog-Channel-Token': 'sync-config-uuid-123',
				'X-Goog-Message-Number': '5',
				'X-Goog-Resource-URI': 'https://www.googleapis.com/calendar/v3/calendars/primary/events?alt=json'
			});

			const response = await POST(event);
			expect(response.status).toBe(200);
		});

		it('should handle event deletion notification', async () => {
			// Simulate Google Calendar sending a notification about a deleted event
			const event = createMockRequest({
				'X-Goog-Channel-ID': 'channel-abc123',
				'X-Goog-Resource-ID': 'o3b9f5e5c0b9ab0c9b3e5a5c9f0e5d',
				'X-Goog-Resource-State': 'not_exists',
				'X-Goog-Channel-Token': 'sync-config-uuid-123',
				'X-Goog-Message-Number': '10',
				'X-Goog-Resource-URI': 'https://www.googleapis.com/calendar/v3/calendars/primary/events?alt=json'
			});

			const response = await POST(event);
			expect(response.status).toBe(200);
		});

		it('should handle initial webhook verification (sync state)', async () => {
			// Google sends this when first setting up the webhook
			const event = createMockRequest({
				'X-Goog-Channel-ID': 'channel-abc123',
				'X-Goog-Resource-ID': 'o3b9f5e5c0b9ab0c9b3e5a5c9f0e5d',
				'X-Goog-Resource-State': 'sync',
				'X-Goog-Channel-Token': 'sync-config-uuid-123',
				'X-Goog-Channel-Expiration': new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString()
			});

			const response = await POST(event);
			expect(response.status).toBe(200);
			expect(await response.text()).toBe('OK');
		});

		it('should handle recurring event modification', async () => {
			// Simulate notification for a change to a recurring event series
			const event = createMockRequest({
				'X-Goog-Channel-ID': 'channel-recurring-456',
				'X-Goog-Resource-ID': 'r5e9c0b9ab0c9b3e5a5c9f0e5d3b9f',
				'X-Goog-Resource-State': 'exists',
				'X-Goog-Channel-Token': 'sync-config-uuid-recurring',
				'X-Goog-Message-Number': '3',
				'X-Goog-Resource-URI': 'https://www.googleapis.com/calendar/v3/calendars/work@example.com/events?alt=json'
			});

			const response = await POST(event);
			expect(response.status).toBe(200);
		});
	});
});
