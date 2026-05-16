import type {
	SyncProvider,
	SyncConfig,
	ExternalEvent,
	WebhookSubscription,
	ProviderType,
	SyncDirection
} from '../types';
import { env } from '$env/dynamic/private';
import { db } from '@ac/db';
import { account } from '@ac/db';
import { eq, and } from '@ac/db';

export class MicrosoftCalendarProvider implements SyncProvider {
	readonly type: ProviderType = 'microsoft-calendar';
	readonly name = 'Microsoft Calendar';
	readonly supportsWebhooks = true;
	readonly supportedDirections: SyncDirection[] = ['pull', 'push', 'bidirectional'];
	readonly supportedEntityTypes: ('event' | 'announcement')[] = ['event'];

	private config?: SyncConfig;
	private accessToken?: string;
	private refreshToken?: string;
	private calendarId = 'primary';

	async initialize(config: SyncConfig): Promise<void> {
		this.config = config;

		if (config.settings?.calendarId) {
			this.calendarId = config.settings.calendarId as string;
		}

		const [userAccount] = await db
			.select()
			.from(account)
			.where(and(
				eq(account.userId, config.userId),
				eq(account.providerId, 'microsoft')
			))
			.limit(1);

		if (!userAccount) {
			throw new Error('No Microsoft account connected. Please reconnect your account.');
		}

		this.accessToken = userAccount.accessToken ?? undefined;
		this.refreshToken = userAccount.refreshToken ?? undefined;

		if (!this.accessToken) {
			throw new Error('Missing access token for Microsoft Calendar');
		}

		if (!this.refreshToken) {
			throw new Error('Missing refresh token for Microsoft Calendar. Please disconnect and reconnect your Microsoft account granting offline_access.');
		}
	}

	async validateConnection(): Promise<boolean> {
		if (!this.accessToken) throw new Error('Provider not initialized');

		try {
			await this.makeRequest('https://graph.microsoft.com/v1.0/me/calendar', { method: 'GET' });
			return true;
		} catch (error) {
			console.error('Microsoft Calendar connection validation failed:', error);
			return false;
		}
	}

	private getBaseUrl(): string {
		return this.calendarId === 'primary' 
			? 'https://graph.microsoft.com/v1.0/me/calendar' 
			: `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(this.calendarId)}`;
	}

	async pullEvents(syncToken?: string): Promise<{
		events: ExternalEvent[];
		nextSyncToken?: string;
	}> {
		if (!this.accessToken) throw new Error('Provider not initialized');

		let url = '';
		if (syncToken) {
			// If we have a sync token, use it (delta query)
			url = syncToken;
		} else {
			// Full sync: last year to next 2 years
			const now = new Date();
			const pastYear = new Date(now);
			pastYear.setFullYear(now.getFullYear() - 1);
			const futureYears = new Date(now);
			futureYears.setFullYear(now.getFullYear() + 2);

			const start = pastYear.toISOString();
			const end = futureYears.toISOString();

			// Use delta endpoint for full sync to get a deltaLink at the end
			url = `${this.getBaseUrl()}/calendarView/delta?startDateTime=${start}&endDateTime=${end}`;
		}

		let allEvents: any[] = [];
		let nextLink = url;
		let deltaLink = undefined;

		// Handle pagination
		while (nextLink) {
			const response: any = await this.makeRequest(nextLink, {
				method: 'GET',
				headers: { 'Prefer': 'odata.maxpagesize=50' }
			});

			if (response.value && response.value.length > 0) {
				allEvents = allEvents.concat(response.value);
			}

			nextLink = response['@odata.nextLink'];
			if (response['@odata.deltaLink']) {
				deltaLink = response['@odata.deltaLink'];
			}
		}

		const events: ExternalEvent[] = allEvents.map(e => this.mapToExternalEvent(e));

		return {
			events,
			nextSyncToken: deltaLink
		};
	}

	async pushEvent(event: ExternalEvent): Promise<{ externalId: string; etag?: string }> {
		if (!this.accessToken) throw new Error('Provider not initialized');

		const msEvent = this.mapToMicrosoftEvent(event);
		const url = `${this.getBaseUrl()}/events`;

		const response = await this.makeRequest<any>(url, {
			method: 'POST',
			body: JSON.stringify(msEvent)
		});

		return {
			externalId: response.id,
			etag: response['@odata.etag']
		};
	}

	async updateEvent(externalId: string, event: ExternalEvent): Promise<{ etag?: string }> {
		if (!this.accessToken) throw new Error('Provider not initialized');

		const msEvent = this.mapToMicrosoftEvent(event);
		const url = `${this.getBaseUrl()}/events/${encodeURIComponent(externalId)}`;

		const response = await this.makeRequest<any>(url, {
			method: 'PATCH',
			body: JSON.stringify(msEvent)
		});

		return {
			etag: response['@odata.etag']
		};
	}

	async deleteEvent(externalId: string): Promise<void> {
		if (!this.accessToken) throw new Error('Provider not initialized');

		const url = `${this.getBaseUrl()}/events/${encodeURIComponent(externalId)}`;

		await this.makeRequest(url, { method: 'DELETE' });
	}

	async setupWebhook(callbackUrl: string): Promise<WebhookSubscription> {
		if (!this.accessToken || !this.config) {
			throw new Error('Provider not initialized');
		}

		// Calculate expiration date (max 4230 minutes = ~2.9 days)
		// We'll use 2 days (2880 minutes) to be safe
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 2);

		const url = 'https://graph.microsoft.com/v1.0/subscriptions';
        
		const resource = this.calendarId === 'primary' 
			? 'me/events' 
			: `me/calendars/${encodeURIComponent(this.calendarId)}/events`;

		const response = await this.makeRequest<any>(url, {
			method: 'POST',
			body: JSON.stringify({
				changeType: 'created,updated,deleted',
				notificationUrl: callbackUrl,
				resource: resource,
				expirationDateTime: expiresAt.toISOString(),
				clientState: this.config.id // Use config ID for verification
			})
		});

		return {
			id: crypto.randomUUID(),
			syncConfigId: this.config.id,
			providerId: this.config.providerId,
			resourceId: response.id, // Graph subscription ID
			channelId: response.id,  // Same as resourceId for Graph
			expiresAt: new Date(response.expirationDateTime),
			createdAt: new Date()
		} as WebhookSubscription;
	}

	async renewWebhook(subscription: WebhookSubscription): Promise<WebhookSubscription> {
		if (!this.accessToken) throw new Error('Provider not initialized');

		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 2);

		const url = `https://graph.microsoft.com/v1.0/subscriptions/${encodeURIComponent(subscription.resourceId)}`;

		const response = await this.makeRequest<any>(url, {
			method: 'PATCH',
			body: JSON.stringify({
				expirationDateTime: expiresAt.toISOString()
			})
		});

		return {
			...subscription,
			expiresAt: new Date(response.expirationDateTime),
		} as WebhookSubscription;
	}

	async cancelWebhook(subscription: WebhookSubscription): Promise<void> {
		if (!this.accessToken) throw new Error('Provider not initialized');

		try {
			const url = `https://graph.microsoft.com/v1.0/subscriptions/${encodeURIComponent(subscription.resourceId)}`;
			await this.makeRequest(url, { method: 'DELETE' });
		} catch (error) {
			console.error('Failed to cancel Microsoft Graph webhook:', error);
		}
	}

	async processWebhook(payload: any): Promise<{
		changes: Array<{ externalId: string; changeType: 'created' | 'updated' | 'deleted' }>;
	}> {
		const changes: Array<{ externalId: string; changeType: 'created' | 'updated' | 'deleted' }> = [];

		if (payload && Array.isArray(payload.value)) {
			for (const notification of payload.value) {
				const externalId = notification.resourceData?.id;
				const changeType = notification.changeType;
				
				if (externalId && changeType) {
					changes.push({ externalId, changeType });
				}
			}
		}

		return { changes };
	}

	private async refreshAccessToken(): Promise<string> {
		if (!this.refreshToken) throw new Error("No refresh token available");
		
		const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				client_id: env.MICROSOFT_CLIENT_ID || '',
				client_secret: env.MICROSOFT_CLIENT_SECRET || '',
				grant_type: 'refresh_token',
				refresh_token: this.refreshToken
			})
		});
		
		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to refresh Microsoft token: ${error}`);
		}
		
		const data = await response.json();
		this.accessToken = data.access_token;
		if (data.refresh_token) {
			this.refreshToken = data.refresh_token;
		}
		
		if (this.config) {
			await db.update(account)
				.set({
					accessToken: this.accessToken,
					refreshToken: this.refreshToken,
					accessTokenExpiresAt: new Date(Date.now() + (data.expires_in * 1000)),
					updatedAt: new Date()
				})
				.where(
					and(
						eq(account.userId, this.config.userId),
						eq(account.providerId, 'microsoft')
					)
				);
		}
		
		return this.accessToken!;
	}

	private async makeRequest<T = any>(url: string, options: RequestInit, retry = true): Promise<T> {
		if (!this.accessToken) throw new Error('Provider not initialized');

		const headers = new Headers(options.headers);
		headers.set('Authorization', `Bearer ${this.accessToken}`);
		if (!headers.has('Content-Type') && options.method !== 'GET' && options.method !== 'DELETE') {
			headers.set('Content-Type', 'application/json');
		}

		const fetchOptions: RequestInit = { ...options, headers };

		const response = await fetch(url, fetchOptions);

		if (!response.ok) {
			if (response.status === 401 && retry) {
				await this.refreshAccessToken();
				headers.set('Authorization', `Bearer ${this.accessToken}`);
				const retryOptions = { ...options, headers };
				
				const retryResponse = await fetch(url, retryOptions);
				if (!retryResponse.ok) {
					const errText = await retryResponse.text();
					throw new Error(`Microsoft Graph API Error after retry: ${retryResponse.statusText} - ${errText}`);
				}
				if (retryResponse.status === 204) return {} as T;
				return retryResponse.json();
			}
			const errText = await response.text();
			throw new Error(`Microsoft Graph API Error: ${response.statusText} - ${errText}`);
		}

		if (response.status === 204) return {} as T;
		return response.json();
	}

	private mapToExternalEvent(msEvent: any): ExternalEvent {
		const isCancelled = msEvent.isCancelled;

		const startDateTime = msEvent.start?.dateTime ? new Date(msEvent.start.dateTime + 'Z') : undefined;
		const endDateTime = msEvent.end?.dateTime ? new Date(msEvent.end.dateTime + 'Z') : undefined;

		return {
			externalId: msEvent.id,
			providerId: this.config!.providerId,
			summary: msEvent.subject || 'Untitled Event',
			status: isCancelled ? 'cancelled' : 'confirmed',
			description: msEvent.body?.content ?? undefined,
			location: msEvent.location?.displayName ?? undefined,
			isAllDay: msEvent.isAllDay ?? false,
			startDateTime,
			startTimeZone: msEvent.start?.timeZone ?? 'UTC',
			endDateTime,
			endTimeZone: msEvent.end?.timeZone ?? 'UTC',
			attendees: msEvent.attendees?.map((a: any) => ({
				email: a.emailAddress?.address,
				displayName: a.emailAddress?.name,
				responseStatus: a.status?.response
			})),
			etag: msEvent['@odata.etag'],
			updatedAt: msEvent.lastModifiedDateTime ? new Date(msEvent.lastModifiedDateTime) : undefined,
			metadata: {
				app_event_id: msEvent.transactionId // we'll use transactionId to store internal id to prevent echoes
			}
		};
	}

	private mapToMicrosoftEvent(event: ExternalEvent): any {
		const msEvent: any = {
			subject: event.summary,
			body: event.description ? { contentType: 'HTML', content: event.description } : undefined,
			location: event.location ? { displayName: event.location } : undefined,
			isAllDay: event.isAllDay,
			transactionId: event.metadata?.app_event_id // Use transactionId for tracking our own ID
		};

		if (event.startDateTime) {
			// MS Graph expects format like "2023-10-01T14:00:00" WITHOUT the Z if timezone is provided.
			// But if we just provide UTC it's fine.
			msEvent.start = {
				dateTime: event.startDateTime.toISOString().split('.')[0],
				timeZone: 'UTC'
			};
		}

		if (event.endDateTime) {
			msEvent.end = {
				dateTime: event.endDateTime.toISOString().split('.')[0],
				timeZone: 'UTC'
			};
		}

		if (event.attendees && event.attendees.length > 0) {
			msEvent.attendees = event.attendees.map(a => ({
				emailAddress: {
					address: a.email,
					name: a.displayName
				},
				type: 'required'
			}));
		}

		return msEvent;
	}
}
