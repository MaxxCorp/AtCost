import type {
	SyncProvider,
	SyncConfig,
	ExternalEvent,
	ProviderType,
	SyncDirection
} from '../types';
import { renderInstagramTemplate } from '../../instagram-templates';

/**
 * Instagram Sync Provider
 * Pushes events and announcements to Instagram as feed posts or stories using Svelte component templates.
 */
export class InstagramProvider implements SyncProvider {
	readonly type: ProviderType = 'instagram';
	readonly name = 'Instagram';
	readonly supportsWebhooks = false;
	readonly supportedDirections: SyncDirection[] = ['push'];
	readonly supportedEntityTypes: ('event' | 'announcement')[] = ['event', 'announcement'];

	private config?: SyncConfig;
	private accessToken?: string;
	private instagramAccountId?: string;
	private selectedTemplate = 'standard';
	private defaultHashtags = '';

	async initialize(config: SyncConfig): Promise<void> {
		this.config = config;

		this.accessToken = config.credentials?.accessToken || config.settings?.accessToken;
		this.instagramAccountId = config.credentials?.instagramAccountId || config.settings?.instagramAccountId;
		this.selectedTemplate = config.settings?.selectedTemplate || 'standard';
		this.defaultHashtags = config.settings?.defaultHashtags || '';
	}

	async validateConnection(): Promise<boolean> {
		if (!this.accessToken || !this.instagramAccountId) {
			// In sandbox / mock mode without API keys, connection is allowed for testing
			return true;
		}

		try {
			const res = await fetch(
				`https://graph.facebook.com/v19.0/${this.instagramAccountId}?fields=id,username&access_token=${this.accessToken}`
			);
			return res.ok;
		} catch (error) {
			console.error('[InstagramProvider] Connection validation failed:', error);
			return false;
		}
	}

	async pullEvents(): Promise<{ events: ExternalEvent[]; nextSyncToken?: string }> {
		throw new Error('Instagram provider only supports push operations');
	}

	async pushEvent(event: ExternalEvent): Promise<{ externalId: string; etag?: string }> {
		if (!this.config) throw new Error('Instagram provider not initialized');

		const templateData = {
			event: {
				summary: event.summary,
				description: event.description,
				startDateTime: event.startDateTime,
				endDateTime: event.endDateTime,
				location: event.location,
				ticketPrice: event.ticketPrice,
				organizer: event.organizer
			},
			hashtags: this.defaultHashtags
		};

		// Render caption & HTML using selected Svelte template
		const { caption } = renderInstagramTemplate(this.selectedTemplate, templateData);

		const imageUrl = event.image?.url || 'https://images.unsplash.com/photo-1511578314322-379afb476865';

		if (this.accessToken && this.instagramAccountId) {
			// 1. Create Media Container
			const containerRes = await fetch(
				`https://graph.facebook.com/v19.0/${this.instagramAccountId}/media`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						image_url: imageUrl,
						caption: caption,
						access_token: this.accessToken
					})
				}
			);

			if (!containerRes.ok) {
				const errorData = await containerRes.text();
				throw new Error(`Failed to create Instagram container: ${containerRes.status} ${errorData}`);
			}

			const containerData = await containerRes.json();
			const containerId = containerData.id;

			// 2. Publish Container
			const publishRes = await fetch(
				`https://graph.facebook.com/v19.0/${this.instagramAccountId}/media_publish`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						creation_id: containerId,
						access_token: this.accessToken
					})
				}
			);

			if (!publishRes.ok) {
				const errorData = await publishRes.text();
				throw new Error(`Failed to publish Instagram media: ${publishRes.status} ${errorData}`);
			}

			const publishData = await publishRes.json();

			return {
				externalId: publishData.id || containerId,
				etag: new Date().toISOString()
			};
		}

		// Mock fallback for development / sandbox without Graph API keys
		console.log(`[InstagramProvider Mock Push] Template: ${this.selectedTemplate}\nCaption:\n${caption}`);
		const mockId = `ig_post_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
		return {
			externalId: mockId,
			etag: new Date().toISOString()
		};
	}

	async updateEvent(externalId: string, event: ExternalEvent): Promise<{ etag?: string }> {
		if (!this.config) throw new Error('Instagram provider not initialized');

		const templateData = {
			event: {
				summary: event.summary,
				description: event.description,
				startDateTime: event.startDateTime,
				endDateTime: event.endDateTime,
				location: event.location,
				ticketPrice: event.ticketPrice,
				organizer: event.organizer
			},
			hashtags: this.defaultHashtags
		};

		const { caption } = renderInstagramTemplate(this.selectedTemplate, templateData);

		if (this.accessToken && this.instagramAccountId) {
			const res = await fetch(`https://graph.facebook.com/v19.0/${externalId}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					caption,
					access_token: this.accessToken
				})
			});

			if (!res.ok) {
				const errorData = await res.text();
				console.warn(`[InstagramProvider] Update warning for ${externalId}: ${res.status} ${errorData}`);
			}
		}

		return { etag: new Date().toISOString() };
	}

	async deleteEvent(externalId: string): Promise<void> {
		if (!this.config) throw new Error('Instagram provider not initialized');

		if (this.accessToken && this.instagramAccountId) {
			await fetch(`https://graph.facebook.com/v19.0/${externalId}?access_token=${this.accessToken}`, {
				method: 'DELETE'
			});
		}
	}
}
