import type {
	SyncProvider,
	SyncConfig,
	ExternalEvent,
	ProviderType,
	SyncDirection
} from '../types';

import {
	WP_EVENTS_CALENDAR_BASE_URL,
	WP_EVENTS_CALENDAR_USERNAME,
	WP_EVENTS_CALENDAR_APP_PASSWORD,
	BETTER_AUTH_URL
} from '$app/env/private';

import crypto from 'crypto';
import { parsePricing } from '../utils/pricing';

/**
 * WordPress The Events Calendar sync provider implementation
 * Pushes events to a WordPress site with The Events Calendar plugin
 */
export class WpTheEventsCalendarProvider implements SyncProvider {
	readonly type: ProviderType = 'wp-the-events-calendar';
	readonly name = 'WP The Events Calendar';
	readonly supportsWebhooks = false;
	readonly supportedDirections: SyncDirection[] = ['push'];
	readonly supportedEntityTypes: ('event' | 'announcement')[] = ['event'];
	readonly supportsNativeRecurrence = false;

	private config?: SyncConfig;
	private baseUrl = '';
	private username = '';
	private applicationPassword = '';

	// In-memory caches to prevent redundant REST API calls during sync runs
	private venueCache = new Map<string, number>();
	private organizerCache = new Map<string, number>();
	private tagCache = new Map<string, number>();
	private imageCache = new Map<string, { id: number; url: string; isNew?: boolean }>();

	async initialize(config: SyncConfig): Promise<void> {
		this.config = config;
		this.venueCache.clear();
		this.organizerCache.clear();
		this.tagCache.clear();
		this.imageCache.clear();

		// Get WordPress credentials from environment variables
		this.baseUrl = WP_EVENTS_CALENDAR_BASE_URL || '';

		this.username = WP_EVENTS_CALENDAR_USERNAME || '';
		this.applicationPassword = WP_EVENTS_CALENDAR_APP_PASSWORD || '';

		if (!this.baseUrl) {
			throw new Error('WP_EVENTS_CALENDAR_BASE_URL environment variable is required');
		}
		if (!this.username) {
			throw new Error('WP_EVENTS_CALENDAR_USERNAME environment variable is required');
		}
		if (!this.applicationPassword) {
			throw new Error('WP_EVENTS_CALENDAR_APP_PASSWORD environment variable is required');
		}

		// Ensure base URL doesn't end with slash
		this.baseUrl = this.baseUrl.replace(/\/$/, '');

		// Override settings if specified in config
		if (config.settings?.baseUrl) {
			this.baseUrl = config.settings.baseUrl.replace(/\/$/, '');
		}
		if (config.settings?.username) {
			this.username = config.settings.username;
		}
		if (config.settings?.applicationPassword) {
			this.applicationPassword = config.settings.applicationPassword;
		}
	}

	async validateConnection(): Promise<boolean> {
		try {
			// Test connection by fetching events endpoint
			const response = await fetch(this.getApiUrl('/tribe/events/v1/events', new URLSearchParams({ per_page: '1' })), {
				method: 'GET',
				headers: {
					'Authorization': `Basic ${Buffer.from(`${this.username}:${this.applicationPassword}`).toString('base64')}`,
					'Content-Type': 'application/json',
				},
			});

			if (!response.ok) {
				const text = await response.text();
				console.error(`[WP-Provider] Connection validation failed: ${response.status} ${response.statusText}`, text);
			}

			return response.ok;
		} catch (error) {
			console.error('Failed to validate WordPress Events Calendar connection:', error);
			return false;
		}
	}

	async pullEvents(): Promise<{
		events: ExternalEvent[];
		nextSyncToken?: string;
	}> {
		// Push-only provider doesn't support pulling
		throw new Error('WordPress Events Calendar provider only supports push operations');
	}

	async pushEvent(event: ExternalEvent): Promise<{ externalId: string; etag?: string }> {
		if (!this.config) {
			throw new Error('Provider not initialized');
		}

		// Map our event to WordPress Events Calendar format
		const wpEventData = this.mapEventToWpFormat(event);

		try {
			// We rely on the generic sync layer to handle mappings.
			// No fuzzy deduplication here, as it conflicts with recurring event series.

			// Ensure venues exist
			const venueIds: number[] = [];
			const venuesToProcess = event.venues && event.venues.length > 0 ? event.venues : event.venue ? [event.venue] : [];

			for (const v of venuesToProcess) {
				const vId = await this.ensureVenue(v, v.id || event.metadata?.locationId || event.venueId);
				if (vId) venueIds.push(vId);
			}

			if (venueIds.length > 0) {
				// Compatibility: Use single ID if only one venue, array if multiple 
				// (Most TEC setups only support one unless Pro is installed)
				wpEventData.venue = venueIds.length === 1 ? venueIds[0] : venueIds;
			}


			// Ensure organizer exists if provided
			if (event.organizer) {
				const organizerId = await this.ensureOrganizer(event.organizer, event.metadata?.organizerId); // organizerId passed in metadata
				if (organizerId) {
					// API expects array of IDs
					wpEventData.organizer = organizerId;
				}
			}

			// Ensure tags
			if (event.tags && event.tags.length > 0) {
				const tagIds: number[] = [];
				for (const tag of event.tags) {
					const tagId = await this.ensureTag(tag);
					if (tagId) tagIds.push(tagId);
				}
				if (tagIds.length > 0) {
					wpEventData.tags = tagIds;
				}
			}

			// Ensure image
			let mediaData: { id: number; url: string; isNew?: boolean } | undefined;
			if (event.image) {
				console.log(`[WP-Sync] Ensuring image: ${event.image.url}`);
				mediaData = await this.ensureImage(event.image);
				if (mediaData) {
					console.log(`[WP-Sync] Image ensured with ID: ${mediaData.id}`);
					// Pass WordPress attachment ID to TEC to link existing media without sideloading duplicates
					wpEventData.image = mediaData.id;
				} else {
					console.warn(`[WP-Sync] Failed to ensure image`);
				}
			}

			console.log(`[WP-Sync] Posting event to WordPress:`, JSON.stringify(wpEventData, null, 2));

			// POST Event
			const response = await fetch(this.getApiUrl('/tribe/events/v1/events'), {
				method: 'POST',
				headers: {
					'Authorization': `Basic ${Buffer.from(`${this.username}:${this.applicationPassword}`).toString('base64')}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(wpEventData),
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error(`[WP-Sync] POST event failed: ${response.status} ${response.statusText}`, errorText);
				throw new Error(`WordPress API error: ${response.status} ${response.statusText} - ${errorText}`);
			}

			const createdEvent = await response.json();

			// Post-link media only if it was newly uploaded to avoid re-parenting across series instances
			if (mediaData?.isNew && createdEvent.id) {
				console.log(`[WP-Sync] Linking newly uploaded media ${mediaData.id} to event ${createdEvent.id}`);
				await fetch(this.getApiUrl(`/wp/v2/media/${mediaData.id}`), {
					method: 'POST',
					headers: {
						'Authorization': `Basic ${Buffer.from(`${this.username}:${this.applicationPassword}`).toString('base64')}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ post: createdEvent.id }),
				}).catch(err => console.warn(`[WP-Sync] Failed to post-link media ${mediaData?.id}:`, err));
			}

			return {
				externalId: createdEvent.id.toString(),
				etag: createdEvent.modified_gmt,
			};
		} catch (error) {
			console.error('Failed to push event to WordPress Events Calendar:', error);
			throw error;
		}
	}

	async updateEvent(externalId: string, event: ExternalEvent): Promise<{ etag?: string }> {
		if (!this.config) {
			throw new Error('Provider not initialized');
		}

		// Map our event to WordPress Events Calendar format
		const wpEventData = this.mapEventToWpFormat(event);

		try {
			// Ensure venues exist
			const venueIds: number[] = [];
			const venuesToProcess = event.venues && event.venues.length > 0 ? event.venues : event.venue ? [event.venue] : [];

			for (const v of venuesToProcess) {
				const vId = await this.ensureVenue(v, v.id || event.metadata?.locationId || event.venueId);
				if (vId) venueIds.push(vId);
			}

			if (venueIds.length > 0) {
				// Compatibility: Use single ID if only one venue, array if multiple
				wpEventData.venue = venueIds.length === 1 ? venueIds[0] : venueIds;
			}


			// Ensure organizer exists if provided
			if (event.organizer) {
				const organizerId = await this.ensureOrganizer(event.organizer, event.metadata?.organizerId); // organizerId passed in metadata
				if (organizerId) {
					// API expects array of IDs
					wpEventData.organizer = [organizerId];
				}
			}

			// Ensure tags
			if (event.tags && event.tags.length > 0) {
				const tagIds: number[] = [];
				for (const tag of event.tags) {
					const tagId = await this.ensureTag(tag);
					if (tagId) tagIds.push(tagId);
				}
				if (tagIds.length > 0) {
					wpEventData.tags = tagIds;
				}
			}

			// Ensure image
			let mediaData: { id: number; url: string; isNew?: boolean } | undefined;
			if (event.image) {
				mediaData = await this.ensureImage(event.image);
				if (mediaData) {
					// Pass WordPress attachment ID to TEC to link existing media without sideloading duplicates
					wpEventData.image = mediaData.id;
				}
			}

			console.log(`[WP-Sync] Updating event ${externalId} in WordPress:`, JSON.stringify(wpEventData, null, 2));

			const response = await fetch(this.getApiUrl(`/tribe/events/v1/events/${externalId}`), {
				method: 'PUT',
				headers: {
					'Authorization': `Basic ${Buffer.from(`${this.username}:${this.applicationPassword}`).toString('base64')}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(wpEventData),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`WordPress API error: ${response.status} ${response.statusText} - ${errorText}`);
			}

			const updatedEvent = await response.json();

			// Post-link media only if it was newly uploaded to avoid re-parenting across series instances
			if (mediaData?.isNew) {
				console.log(`[WP-Sync] Linking newly uploaded media ${mediaData.id} to event ${externalId}`);
				await fetch(this.getApiUrl(`/wp/v2/media/${mediaData.id}`), {
					method: 'POST',
					headers: {
						'Authorization': `Basic ${Buffer.from(`${this.username}:${this.applicationPassword}`).toString('base64')}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ post: externalId }),
				}).catch(err => console.warn(`[WP-Sync] Failed to post-link media ${mediaData?.id}:`, err));
			}

			return {
				etag: updatedEvent.modified_gmt,
			};
		} catch (error) {
			console.error('Failed to update event in WordPress Events Calendar:', error);
			throw error;
		}
	}

	async deleteEvent(externalId: string): Promise<void> {
		if (!this.config) {
			throw new Error('Provider not initialized');
		}

		try {
			const response = await fetch(this.getApiUrl(`/tribe/events/v1/events/${externalId}`, new URLSearchParams({ force: 'true' })), {
				method: 'DELETE',
				headers: {
					'Authorization': `Basic ${Buffer.from(`${this.username}:${this.applicationPassword}`).toString('base64')}`,
					'Content-Type': 'application/json',
				},
			});

			if (!response.ok) {
				if (response.status === 404) {
					console.log(`[WP-Provider] Event ${externalId} already deleted from WordPress Events Calendar`);
					return;
				}
				const errorText = await response.text();
				throw new Error(`WordPress API error: ${response.status} ${response.statusText} - ${errorText}`);
			}
		} catch (error: any) {
			if (error?.message?.includes('404')) {
				console.log(`[WP-Provider] Event ${externalId} already deleted from WordPress Events Calendar`);
				return;
			}
			console.error('Failed to delete event from WordPress Events Calendar:', error);
			throw error;
		}
	}

	/**
	 * Ensure valid venue exists in WordPress
	 * @param venue Venue data
	 * @param internalId Internal Location ID
	 * @returns Venue ID
	 */
	private async ensureVenue(venue: NonNullable<ExternalEvent['venue']>, internalId?: string): Promise<number | undefined> {
		if (!this.config || !venue?.name || (venue as any).isPublic === false) return undefined;

		try {
			// Check in-memory cache first
			const cacheKey = internalId || venue.name;
			if (this.venueCache.has(cacheKey)) {
				return this.venueCache.get(cacheKey);
			}

			// 1. Search for existing venue by name
			const searchParams = new URLSearchParams();
			searchParams.set('search', venue.name);

			const searchUrl = this.getApiUrl('/tribe/events/v1/venues', searchParams);
			const searchResponse = await fetch(searchUrl, {
				method: 'GET',
				headers: {
					'Authorization': `Basic ${Buffer.from(`${this.username}:${this.applicationPassword}`).toString('base64')}`,
					'Content-Type': 'application/json',
				},
			});

			let externalId: string | undefined;

			if (searchResponse.ok) {
				const searchResult = await searchResponse.json();
				if (searchResult.venues && searchResult.venues.length > 0) {
					externalId = searchResult.venues[0].id.toString();
				}
			}

			// 2. Create new venue if not found
			if (!externalId) {
				console.log(`[WP-Sync] Creating new venue: ${venue.name}`);
				const venueData: any = {
					venue: venue.name,
					address: venue.address,
					city: venue.city,
					country: venue.country,
					province: venue.province,
					zip: venue.zip,
					phone: venue.phone,
					website: venue.website,
					show_map: 'true',
					show_map_link: 'true',
					status: 'publish' // Ensure it's available immediately
				};

				const createResponse = await fetch(this.getApiUrl('/tribe/events/v1/venues'), {
					method: 'POST',
					headers: {
						'Authorization': `Basic ${Buffer.from(`${this.username}:${this.applicationPassword}`).toString('base64')}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(venueData),
				});

				if (createResponse.ok) {
					const createdVenue = await createResponse.json();
					externalId = createdVenue.id.toString();
				} else {
					const errorText = await createResponse.text();
					console.error(`Failed to create venue in WordPress: ${createResponse.status} - ${errorText}`);
				}
			}

			if (externalId) {
				const parsedId = parseInt(externalId, 10);
				this.venueCache.set(cacheKey, parsedId);
				if (internalId && venue.name) {
					this.venueCache.set(venue.name, parsedId);
				}
				return parsedId;
			}

			return undefined;

		} catch (error) {
			console.error('Error ensuring venue in WordPress:', error);
		}

		return undefined;
	}

	/**
	 * Ensure valid organizer exists in WordPress
	 * @param organizer Organizer data
	 * @param internalId Internal Contact ID
	 * @returns Organizer ID
	 */
	private async ensureOrganizer(organizer: NonNullable<ExternalEvent['organizer']>, internalId?: string): Promise<number | undefined> {
		if (!this.config || !organizer?.name || (organizer as any).isPublic === false) return undefined;

		try {
			// Check in-memory cache first
			const cacheKey = internalId || organizer.email || organizer.name;
			if (this.organizerCache.has(cacheKey)) {
				return this.organizerCache.get(cacheKey);
			}

			// 1. Search
			const searchParams = new URLSearchParams();
			searchParams.set('search', organizer.email || organizer.name);

			const searchUrl = this.getApiUrl('/tribe/events/v1/organizers', searchParams);
			const searchResponse = await fetch(searchUrl, {
				method: 'GET',
				headers: {
					'Authorization': `Basic ${Buffer.from(`${this.username}:${this.applicationPassword}`).toString('base64')}`,
					'Content-Type': 'application/json',
				},
			});

			let externalId: string | undefined;

			if (searchResponse.ok) {
				const searchResult = await searchResponse.json();
				if (searchResult.organizers && searchResult.organizers.length > 0) {
					if (organizer.email) {
						const match = searchResult.organizers.find((o: any) => o.email === organizer.email);
						if (match) externalId = match.id.toString();
					}
					if (!externalId) {
						const match = searchResult.organizers.find((o: any) => o.organizer === organizer.name);
						if (match) externalId = match.id.toString();
					}
				}
			}

			// 2. Create
			if (!externalId) {
				const organizerData: any = {
					organizer: organizer.name,
					email: organizer.email,
					phone: organizer.phone,
					website: organizer.website,
					status: 'publish' // Ensure it's available immediately
				};

				const createResponse = await fetch(this.getApiUrl('/tribe/events/v1/organizers'), {
					method: 'POST',
					headers: {
						'Authorization': `Basic ${Buffer.from(`${this.username}:${this.applicationPassword}`).toString('base64')}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(organizerData),
				});

				if (createResponse.ok) {
					const createdOrganizer = await createResponse.json();
					externalId = createdOrganizer.id.toString();
				} else {
					console.error(`Failed to create organizer in WordPress: ${createResponse.status}`);
				}
			}

			if (externalId) {
				const parsedId = parseInt(externalId, 10);
				this.organizerCache.set(cacheKey, parsedId);
				if (organizer.email) this.organizerCache.set(organizer.email, parsedId);
				if (organizer.name) this.organizerCache.set(organizer.name, parsedId);
				return parsedId;
			}

			return undefined;
		} catch (error) {
			console.error('Error ensuring organizer in WordPress:', error);
		}

		return undefined;
	}

	/**
	 * Ensure valid tag exists in WordPress
	 * @param tag Tag data
	 * @returns Tag ID
	 */
	private async ensureTag(tag: { id: string; name: string; visibility?: string }): Promise<number | undefined> {
		if (!this.config || !tag?.name || (tag.visibility && tag.visibility !== 'external')) return undefined;

		try {
			// Check in-memory cache first
			const cacheKey = tag.id || tag.name;
			if (this.tagCache.has(cacheKey)) {
				return this.tagCache.get(cacheKey);
			}

			// 1. Search
			const searchParams = new URLSearchParams();
			searchParams.set('search', tag.name);
			const searchUrl = this.getApiUrl('/wp/v2/tags', searchParams);
			const searchResponse = await fetch(searchUrl, {
				method: 'GET',
				headers: {
					'Authorization': `Basic ${Buffer.from(`${this.username}:${this.applicationPassword}`).toString('base64')}`,
					'Content-Type': 'application/json',
				},
			});

			let externalId: string | undefined;

			if (searchResponse.ok) {
				const tags = await searchResponse.json();
				if (tags && tags.length > 0) {
					const match = tags.find((t: any) => t.name.toLowerCase() === tag.name.toLowerCase());
					if (match) externalId = match.id.toString();
				}
			}

			// 2. Create
			if (!externalId) {
				const createResponse = await fetch(this.getApiUrl('/wp/v2/tags'), {
					method: 'POST',
					headers: {
						'Authorization': `Basic ${Buffer.from(`${this.username}:${this.applicationPassword}`).toString('base64')}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ name: tag.name }),
				});

				if (createResponse.ok) {
					const createdTag = await createResponse.json();
					externalId = createdTag.id.toString();
				}
			}

			if (externalId) {
				const parsedId = parseInt(externalId, 10);
				this.tagCache.set(cacheKey, parsedId);
				this.tagCache.set(tag.name, parsedId);
				return parsedId;
			}

			return undefined;
		} catch (error) {
			console.error('Error ensuring tag in WordPress:', error);
		}
		return undefined;
	}

	/**
	 * Ensure image exists in WordPress
	 * @param image Image data
	 * @returns Media ID and URL
	 */
	private async ensureImage(image: { url: string; title?: string }): Promise<{ id: number; url: string; isNew?: boolean } | undefined> {
		try {
			// In-memory cache check by URL (instant deduplication across instances of the same series during sync)
			if (this.imageCache.has(image.url)) {
				const cached = this.imageCache.get(image.url)!;
				console.log(`[WP-Sync] Image URL in-memory match found! Reusing media ID: ${cached.id}`);
				return { id: cached.id, url: cached.url, isNew: false };
			}

			console.log(`[WP-Sync] ensureImage check for: ${image.url}`);

			// 1. Download the image first so we can hash it for deduplication
			const imageResponse = await fetch(image.url);
			if (!imageResponse.ok) return undefined;

			const arrayBuffer = await imageResponse.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);

			// 2. Hash the image buffer
			const hash = crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 16);

			// In-memory cache check by hash (same image buffer under a different URL)
			if (this.imageCache.has(hash)) {
				const cached = this.imageCache.get(hash)!;
				console.log(`[WP-Sync] Image hash in-memory match found! Reusing media ID: ${cached.id}`);
				const result = { id: cached.id, url: cached.url, isNew: false };
				this.imageCache.set(image.url, result);
				return result;
			}

			// Clean query parameters and fragments from URL
			const cleanUrl = image.url.split('?')[0].split('#')[0];
			const rawFilename = decodeURIComponent(cleanUrl.split('/').pop() || 'image.jpg');

			// Extract clean extension and base name
			const lastDotIndex = rawFilename.lastIndexOf('.');
			const ext = (lastDotIndex !== -1 ? rawFilename.substring(lastDotIndex + 1).toLowerCase() : 'jpg').replace(/[^a-z0-9]/g, '') || 'jpg';
			const baseName = lastDotIndex !== -1 ? rawFilename.substring(0, lastDotIndex) : rawFilename;
			const safeBaseName = baseName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'image';

			// Create a precise slug based on the hash to guarantee finding it later
			const uniqueSlug = `${hash}-${safeBaseName}`.substring(0, 90);
			const uploadFilename = `${uniqueSlug}.${ext}`;

			// 3. Search WordPress by this exact hash-slug first
			const slugParams = new URLSearchParams();
			slugParams.set('slug', uniqueSlug);
			slugParams.set('media_type', 'image');
			slugParams.set('status', 'inherit,publish,any');

			const searchUrl = this.getApiUrl('/wp/v2/media', slugParams);
			const searchResponse = await fetch(searchUrl, {
				method: 'GET',
				headers: {
					'Authorization': `Basic ${Buffer.from(`${this.username}:${this.applicationPassword}`).toString('base64')}`,
				},
			});

			if (searchResponse.ok) {
				const media = await searchResponse.json();
				if (Array.isArray(media) && media.length > 0) {
					console.log(`[WP-Sync] Image slug match found! Reusing media ID: ${media[0].id}`);
					const result = { id: media[0].id, url: media[0].source_url };
					this.imageCache.set(image.url, result);
					this.imageCache.set(hash, result);
					return result;
				}
			}

			// Fallback search: search by the 16-character sha256 hash in case WP appended a suffix or slug differed
			const fallbackParams = new URLSearchParams();
			fallbackParams.set('search', hash);
			fallbackParams.set('media_type', 'image');
			fallbackParams.set('status', 'inherit,publish,any');

			const fallbackUrl = this.getApiUrl('/wp/v2/media', fallbackParams);
			const fallbackResponse = await fetch(fallbackUrl, {
				method: 'GET',
				headers: {
					'Authorization': `Basic ${Buffer.from(`${this.username}:${this.applicationPassword}`).toString('base64')}`,
				},
			});

			if (fallbackResponse.ok) {
				const media = await fallbackResponse.json();
				if (Array.isArray(media) && media.length > 0) {
					const matched = media.find((m: any) =>
						(m.slug && m.slug.includes(hash)) ||
						(m.source_url && m.source_url.includes(hash)) ||
						(m.title?.rendered && m.title.rendered.includes(hash))
					);
					if (matched) {
						console.log(`[WP-Sync] Image hash fallback search match found! Reusing media ID: ${matched.id}`);
						const result = { id: matched.id, url: matched.source_url };
						this.imageCache.set(image.url, result);
						this.imageCache.set(hash, result);
						return result;
					}
				}
			}

			// 4. Upload if not found
			console.log(`[WP-Sync] Image hash not found, uploading as: ${uploadFilename}`);
			const uploadParams = new URLSearchParams();
			uploadParams.set('slug', uniqueSlug);
			uploadParams.set('title', uniqueSlug);

			const uploadResponse = await fetch(this.getApiUrl('/wp/v2/media', uploadParams), {
				method: 'POST',
				headers: {
					'Authorization': `Basic ${Buffer.from(`${this.username}:${this.applicationPassword}`).toString('base64')}`,
					'Content-Disposition': `attachment; filename="${uploadFilename}"`,
					'Content-Type': imageResponse.headers.get('content-type') || `image/${ext === 'png' ? 'png' : ext === 'webp' ? 'webp' : ext === 'gif' ? 'gif' : 'jpeg'}`,
				},
				body: buffer,
			});

			if (uploadResponse.ok) {
				const uploadedMedia = await uploadResponse.json();
				const result = { id: uploadedMedia.id, url: uploadedMedia.source_url, isNew: true };
				this.imageCache.set(image.url, result);
				this.imageCache.set(hash, result);
				return result;
			} else {
				const errorText = await uploadResponse.text();
				console.error(`[WP-Sync] Failed to upload image to WordPress: ${uploadResponse.status} ${uploadResponse.statusText}`);
				console.error(`[WP-Sync] Error response: ${errorText}`);
			}

		} catch (error) {
			console.error('Error ensuring image in WordPress:', error);
		}
		return undefined;
	}

	private mapEventToWpFormat(event: ExternalEvent): any {
		// If description is empty or contains no meaningful content, use an invisible string
		// (zero-width space) so the sync will not be rejected by The Events Calendar WP plugin API.
		const hasContent = Boolean(event.description && (event.description.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/[\s\u200B\uFEFF]/g, '').length > 0 || (/<(img|iframe|svg|video|audio|figure)\b/i).test(event.description)));

		const description = hasContent ? event.description! : '\u200B';

		// Map our internal event format to WordPress Events Calendar REST API format
		const wpEvent: any = {
			title: event.summary,
			description,
			status: 'publish', // Publish immediately
			hide_from_listings: false,
			show_map: 'true',
			show_map_link: 'true',
		};

		// Resolve timezone, falling back to Europe/Berlin (since we must provide a timezone to WP to avoid offsets)
		const resolvedTz = event.startTimeZone || process.env.TZ || 'Europe/Berlin';

		// Format date helper
		const formatDate = (date: Date, timeZone: string): { date: string; time: string } => {
			const tz = timeZone;

			// Format date part (YYYY-MM-DD)
			const datePart = new Intl.DateTimeFormat('en-CA', { // en-CA gives YYYY-MM-DD
				timeZone: tz,
				year: 'numeric',
				month: '2-digit',
				day: '2-digit'
			}).format(date);

			// Format time part (HH:MM:SS) - The Events Calendar expects seconds
			const timePart = new Intl.DateTimeFormat('en-GB', { // en-GB gives HH:MM:SS (24h)
				timeZone: tz,
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit',
				hour12: false
			}).format(date);

			return { date: datePart, time: timePart };
		};

		// Handle start date/time
		if (event.startDateTime) {
			const { date, time } = formatDate(event.startDateTime, resolvedTz);
			if (event.isAllDay) {
				wpEvent.start_date = `${date} 00:00:00`;
				wpEvent.all_day = true;
			} else {
				wpEvent.start_date = `${date} ${time}`;
			}
		}

		// Handle end date/time
		if (event.endDateTime) {
			const { date, time } = formatDate(event.endDateTime, event.endTimeZone || resolvedTz);
			if (event.isAllDay) {
				wpEvent.end_date = `${date} 23:59:59`;
			} else {
				wpEvent.end_date = `${date} ${time}`;
			}
		}

		// Always explicitly include the mapped timezone so WP Events Calendar evaluates the time string properly
		wpEvent.timezone = resolvedTz;

		/* // Handle recurrence if present
		if (event.recurrence && event.recurrence.length > 0) {
			const rrule = event.recurrence[0];
			if (rrule.includes('FREQ=WEEKLY')) {
				wpEvent.recurrence = {
					type: 'weekly',
					end_type: 'never',
				};
			} else if (rrule.includes('FREQ=DAILY')) {
				wpEvent.recurrence = {
					type: 'daily',
					end_type: 'never',
				};
			}
		} */

		// Hardcoded category mapping rule based on location
		const CAT_STZ = 109;
		const CAT_DEFAULT = 110;
		const stzLocations = [
			'STZ Biesdorf - Gelbe Villa',
			'STZ Biesdorf - Historischer Pferdestall',
			'Schloss Biesdorf',
			'Haus der Zukunft am ukb'
		];

		const venues =
			event.venues && event.venues.length > 0 ? event.venues : event.venue ? [event.venue] : [];
		const isStzEvent = venues.some((v) => stzLocations.includes(v.name));

		wpEvent.categories = isStzEvent ? [CAT_STZ] : [CAT_DEFAULT];

		// Handle custom fields if present in metadata
		if (event.metadata?.customFields) {
			wpEvent.meta = event.metadata.customFields;
		}

		// Map Website URL
		if (event.metadata?.eventId && BETTER_AUTH_URL) {
			wpEvent.website = `${BETTER_AUTH_URL}/events/${event.metadata.eventId}/view`;
		} else if (event.source?.url) {
			// Fallback to source URL
			wpEvent.website = event.source.url;
		}

		// Map Cost/Price
		const isPriceUnknown = Boolean(
			event.ticketPriceUnknown ||
			event.metadata?.ticketPriceUnknown ||
			(event.ticketPrice && ['unbekannt', 'unknown', 'bitte erfragen', 'preis bitte erfragen'].includes(event.ticketPrice.trim().toLowerCase()))
		);

		if (isPriceUnknown) {
			wpEvent.cost = '';
		} else if (event.ticketPrice) {
			const { priceValue } = parsePricing(event.ticketPrice);
			wpEvent.cost = priceValue;
		}

		return wpEvent;
	}

	/**
	 * Builds a WordPress REST API URL.
	 * Handles both "Pretty" ( /wp-json/ ) and "Plain" ( ?rest_route=/ ) permalink structures.
	 */
	private getApiUrl(path: string, params?: URLSearchParams): string {
		const cleanPath = path.startsWith('/') ? path : `/${path}`;

		// We use the rest_route format as it is universally supported regardless of permalink settings.
		const url = new URL(this.baseUrl);
		url.searchParams.set('rest_route', cleanPath);

		if (params) {
			for (const [key, value] of params.entries()) {
				url.searchParams.append(key, value);
			}
		}

		return url.toString();
	}

}

