import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WpTheEventsCalendarProvider } from './wp-the-events-calendar';
import type { SyncConfig } from '../types';
import crypto from 'crypto';

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

	describe('ticketPrice / cost field mapping', () => {
		it('maps numeric ticket prices to cost field', () => {
			const format = (provider as any).mapEventToWpFormat.bind(provider);

			const formatted = format({
				externalId: '',
				providerId: 'wp-the-events-calendar',
				summary: 'Paid Concert',
				ticketPrice: '15'
			});
			expect(formatted.cost).toBe('15');
		});

		it('maps ticketPrice to "" when ticketPriceUnknown is true', () => {
			const format = (provider as any).mapEventToWpFormat.bind(provider);

			const formatted = format({
				externalId: '',
				providerId: 'wp-the-events-calendar',
				summary: 'Unknown Price Event',
				ticketPrice: '0',
				ticketPriceUnknown: true
			});
			expect(formatted.cost).toBe('');
		});

		it('maps ticketPrice to "" when metadata.ticketPriceUnknown is true', () => {
			const format = (provider as any).mapEventToWpFormat.bind(provider);

			const formatted = format({
				externalId: '',
				providerId: 'wp-the-events-calendar',
				summary: 'Unknown Price Event via Metadata',
				ticketPrice: '0',
				metadata: { ticketPriceUnknown: true }
			});
			expect(formatted.cost).toBe('');
		});

		it('maps ticketPrice to "" when ticketPrice is explicitly "Unbekannt" or "Bitte erfragen"', () => {
			const format = (provider as any).mapEventToWpFormat.bind(provider);

			const withUnbekannt = format({
				externalId: '',
				providerId: 'wp-the-events-calendar',
				summary: 'Unbekannt Price',
				ticketPrice: 'Unbekannt'
			});
			expect(withUnbekannt.cost).toBe('');

			const withBitteErfragen = format({
				externalId: '',
				providerId: 'wp-the-events-calendar',
				summary: 'Bitte erfragen Price',
				ticketPrice: 'Bitte erfragen'
			});
			expect(withBitteErfragen.cost).toBe('');

			const withPreisBitteErfragen = format({
				externalId: '',
				providerId: 'wp-the-events-calendar',
				summary: 'Preis bitte erfragen Price',
				ticketPrice: 'Preis bitte erfragen'
			});
			expect(withPreisBitteErfragen.cost).toBe('');
		});

		it('maps genuine free admission ("0") to "0" when ticketPriceUnknown is false', () => {
			const format = (provider as any).mapEventToWpFormat.bind(provider);

			const formatted = format({
				externalId: '',
				providerId: 'wp-the-events-calendar',
				summary: 'Free Workshop',
				ticketPrice: '0',
				ticketPriceUnknown: false
			});
			expect(formatted.cost).toBe('0');
		});
	});

	describe('public privacy guards in ensureVenue, ensureOrganizer, and ensureTag', () => {
		it('refuses to sync non-public venues (isPublic === false)', async () => {
			const mockFetch = vi.fn();
			global.fetch = mockFetch;

			const venueId = await (provider as any).ensureVenue(
				{ name: 'Private Venue', isPublic: false },
				'loc-priv-1'
			);
			expect(venueId).toBeUndefined();
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it('refuses to sync non-public organizers (isPublic === false)', async () => {
			const mockFetch = vi.fn();
			global.fetch = mockFetch;

			const organizerId = await (provider as any).ensureOrganizer(
				{ name: 'Private Organizer', email: 'priv@org.com', isPublic: false },
				'ctc-priv-1'
			);
			expect(organizerId).toBeUndefined();
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it('refuses to sync internal tags (visibility !== "external")', async () => {
			const mockFetch = vi.fn();
			global.fetch = mockFetch;

			const tagId = await (provider as any).ensureTag({
				id: 'tag-int-1',
				name: 'InternalTag',
				visibility: 'internal'
			});
			expect(tagId).toBeUndefined();
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	describe('Hero Image Deduplication & Media ID Assignment', () => {
		it('passes numeric media ID to The Events Calendar API instead of image URL to prevent duplicate sideloading', async () => {
			const imageBuffer = Buffer.from('fake-image-bytes');
			const mockFetch = vi.fn().mockImplementation((url: string, opts?: any) => {
				const strUrl = decodeURIComponent(String(url));
				if (strUrl.includes('example.com/hero.jpg')) {
					// 1. Image download
					return Promise.resolve({
						ok: true,
						status: 200,
						arrayBuffer: () => Promise.resolve(imageBuffer.buffer),
						headers: { get: () => 'image/jpeg' }
					});
				}
				if (strUrl.includes('/wp/v2/media') && opts?.method === 'GET') {
					// 2. Search returns not found
					return Promise.resolve({
						ok: true,
						status: 200,
						json: () => Promise.resolve([])
					});
				}
				if (strUrl.includes('/wp/v2/media') && opts?.method === 'POST') {
					// 3. Upload new media
					return Promise.resolve({
						ok: true,
						status: 201,
						json: () => Promise.resolve({ id: 555, source_url: 'https://example.com/wp-content/uploads/555.jpg' })
					});
				}
				if (strUrl.includes('/tribe/events/v1/events') && opts?.method === 'POST') {
					// 4. Create event
					return Promise.resolve({
						ok: true,
						status: 201,
						json: () => Promise.resolve({ id: 101, modified_gmt: '2026-10-01T12:00:00Z' })
					});
				}
				return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
			});
			global.fetch = mockFetch;

			await provider.pushEvent({
				externalId: '',
				providerId: 'wp-the-events-calendar',
				summary: 'Concert with Hero Image',
				description: 'Great show',
				startDateTime: new Date('2026-10-01T10:00:00Z'),
				endDateTime: new Date('2026-10-01T12:00:00Z'),
				image: { url: 'https://example.com/hero.jpg' }
			});

			const eventCreateCall = mockFetch.mock.calls.find(call => decodeURIComponent(String(call[0])).includes('/tribe/events/v1/events') && call[1]?.method === 'POST');
			expect(eventCreateCall).toBeDefined();
			const payload = JSON.parse(eventCreateCall![1].body);

			// CRITICAL: image must be the integer attachment ID (555), NEVER the URL string
			expect(payload.image).toBe(555);
		});

		it('deduplicates image across multiple series instances using in-memory cache without extra network calls', async () => {
			const imageBuffer = Buffer.from('shared-series-image');
			let downloadCount = 0;
			let uploadCount = 0;

			const mockFetch = vi.fn().mockImplementation((url: string, opts?: any) => {
				const strUrl = decodeURIComponent(String(url));
				if (strUrl.includes('example.com/series-hero.png')) {
					downloadCount++;
					return Promise.resolve({
						ok: true,
						status: 200,
						arrayBuffer: () => Promise.resolve(imageBuffer.buffer),
						headers: { get: () => 'image/png' }
					});
				}
				if (strUrl.includes('/wp/v2/media') && opts?.method === 'GET') {
					return Promise.resolve({
						ok: true,
						status: 200,
						json: () => Promise.resolve([])
					});
				}
				if (strUrl.includes('/wp/v2/media') && opts?.method === 'POST') {
					// Only count the actual image upload, not post-linking
					if (!strUrl.includes('/wp/v2/media/')) {
						uploadCount++;
					}
					return Promise.resolve({
						ok: true,
						status: 201,
						json: () => Promise.resolve({ id: 777, source_url: 'https://example.com/wp-content/uploads/777.png' })
					});
				}
				if (strUrl.includes('/tribe/events/v1/events') && opts?.method === 'POST') {
					return Promise.resolve({
						ok: true,
						status: 201,
						json: () => Promise.resolve({ id: 200, modified_gmt: '2026-10-01T12:00:00Z' })
					});
				}
				return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
			});
			global.fetch = mockFetch;

			const sharedImage = { url: 'https://example.com/series-hero.png?query=token' };

			// Sync Instance 1
			await provider.pushEvent({
				externalId: '',
				providerId: 'wp-the-events-calendar',
				summary: 'Instance 1',
				description: 'Series 1',
				startDateTime: new Date('2026-10-01T10:00:00Z'),
				endDateTime: new Date('2026-10-01T12:00:00Z'),
				image: sharedImage
			});

			// Sync Instance 2 with exact same image
			await provider.pushEvent({
				externalId: '',
				providerId: 'wp-the-events-calendar',
				summary: 'Instance 2',
				description: 'Series 2',
				startDateTime: new Date('2026-10-08T10:00:00Z'),
				endDateTime: new Date('2026-10-08T12:00:00Z'),
				image: sharedImage
			});

			// Image should only be downloaded once and uploaded once!
			expect(downloadCount).toBe(1);
			expect(uploadCount).toBe(1);
		});

		it('reuses existing media when found via fallback hash search even if exact slug differed', async () => {
			const bytes = new Uint8Array(Buffer.from('known-image-bytes'));
			const expectedHash = crypto.createHash('sha256').update(bytes).digest('hex').substring(0, 16);
			let uploadAttempted = false;

			const mockFetch = vi.fn().mockImplementation((url: string, opts?: any) => {
				const strUrl = decodeURIComponent(String(url));
				if (strUrl.includes('example.com/poster.jpg')) {
					return Promise.resolve({
						ok: true,
						status: 200,
						arrayBuffer: () => Promise.resolve(bytes.buffer.slice(0, bytes.byteLength)),
						headers: { get: () => 'image/jpeg' }
					});
				}
				if (strUrl.includes('/wp/v2/media') && opts?.method === 'GET') {
					if (strUrl.includes('slug=')) {
						// Slug search misses
						return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
					}
					if (strUrl.includes('search=')) {
						// Fallback hash search finds the previously uploaded attachment!
						return Promise.resolve({
							ok: true,
							status: 200,
							json: () => Promise.resolve([{
								id: 888,
								slug: `${expectedHash}-poster-1`,
								source_url: 'https://example.com/wp-content/uploads/poster.jpg'
							}])
						});
					}
				}
				if (strUrl.includes('/wp/v2/media') && opts?.method === 'POST') {
					if (!strUrl.includes('/wp/v2/media/')) {
						uploadAttempted = true;
					}
					return Promise.resolve({ ok: true, status: 201, json: () => Promise.resolve({ id: 999 }) });
				}
				if (strUrl.includes('/tribe/events/v1/events/300') && opts?.method === 'PUT') {
					return Promise.resolve({
						ok: true,
						status: 200,
						json: () => Promise.resolve({ id: 300, modified_gmt: '2026-10-01T12:00:00Z' })
					});
				}
				return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
			});
			global.fetch = mockFetch;

			await provider.updateEvent('300', {
				externalId: '300',
				providerId: 'wp-the-events-calendar',
				summary: 'Updated Event',
				description: 'Desc',
				startDateTime: new Date('2026-10-01T10:00:00Z'),
				endDateTime: new Date('2026-10-01T12:00:00Z'),
				image: { url: 'https://example.com/poster.jpg' }
			});

			// Should have reused media 888 and NOT uploaded a new copy
			expect(uploadAttempted).toBe(false);
			const updateCall = mockFetch.mock.calls.find(call => decodeURIComponent(String(call[0])).includes('/tribe/events/v1/events/300') && call[1]?.method === 'PUT');
			expect(updateCall).toBeDefined();
			const payload = JSON.parse(updateCall![1].body);
			expect(payload.image).toBe(888);
		});
	});
});

