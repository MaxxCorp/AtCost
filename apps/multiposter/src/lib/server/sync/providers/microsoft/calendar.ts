import type {
	SyncProvider,
	SyncConfig,
	ExternalEvent,
	WebhookSubscription,
	ProviderType,
	SyncDirection
} from '../../types';

import { MicrosoftGraphClient } from './client';
import {
	formatLocal,
	mapRRuleToMicrosoftRecurrence,
	mapMicrosoftRecurrenceToRRule
} from './recurrence';

export class MicrosoftCalendarProvider implements SyncProvider {
	readonly type: ProviderType = 'microsoft-calendar';
	readonly name = 'Microsoft Calendar';
	readonly supportsWebhooks = true;
	readonly supportedDirections: SyncDirection[] = ['pull', 'push', 'bidirectional'];
	readonly supportedEntityTypes: ('event' | 'announcement')[] = ['event'];
	readonly supportsNativeRecurrence = true;

	private client = new MicrosoftGraphClient();
	private config?: SyncConfig;

	get calendarId(): string {
		return (this as any)._calendarId ?? this.client.getCalendarId();
	}
	set calendarId(val: string) {
		(this as any)._calendarId = val;
		if ((this.client as any).config) {
			(this.client as any).config.calendarId = val;
		}
	}

	get accessToken(): string | undefined {
		return (this.client as any).accessToken;
	}
	set accessToken(val: string | undefined) {
		(this.client as any).accessToken = val;
	}

	async makeRequest<T = any>(url: string, options: RequestInit = {}): Promise<T> {
		return this.client.makeRequest<T>(url, options);
	}

	shouldSyncEvent(event: any): boolean {
		return true;
	}

	async initialize(config: SyncConfig): Promise<void> {
		this.config = config;
		await this.client.initialize(config);
	}

	getClient(): MicrosoftGraphClient {
		return this.client;
	}

	/**
	 * Validates that the specified calendar is available and accessible.
	 * Throws an explicit error if the calendar is not found or inaccessible.
	 */
	async validateCalendarAccess(): Promise<void> {
		if (!this.accessToken) {
			throw new Error('Provider not initialized');
		}

		const calendarId = this.calendarId;
		const isPrimary = calendarId === 'primary';
		const url = this.getBaseUrl();

		try {
			await this.makeRequest(url, { method: 'GET' });
		} catch (error: any) {
			const target = isPrimary
				? 'primary calendar'
				: `calendar "${calendarId}"`;
			console.error(`[MicrosoftCalendarProvider] Specified ${target} is not available:`, error);
			throw new Error(`Microsoft Calendar sync failed: Specified ${target} is not available or accessible (${error.message || error}).`);
		}
	}

	async validateConnection(): Promise<boolean> {
		try {
			await this.validateCalendarAccess();
			return true;
		} catch (error) {
			console.error('Microsoft Calendar connection validation failed:', error);
			return false;
		}
	}

	private getBaseUrl(): string {
		if (this.calendarId && this.calendarId.includes('@')) {
			return `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(this.calendarId)}/calendar`;
		}
		return this.client.getCalendarBaseUrl(undefined, this.calendarId);
	}

	async pullEvents(syncToken?: string): Promise<{
		events: ExternalEvent[];
		nextSyncToken?: string;
	}> {
		if (!syncToken) {
			await this.validateCalendarAccess();
		}

		let url = '';
		if (syncToken) {
			url = syncToken;
		} else {
			url = `${this.getBaseUrl()}/events/delta`;
		}

		let allEvents: any[] = [];
		let nextLink: string | undefined = url;
		let deltaLink: string | undefined = undefined;

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

		const events: ExternalEvent[] = allEvents.map((e) => this.mapToExternalEvent(e));

		return {
			events,
			nextSyncToken: deltaLink
		};
	}

	async pushEvent(event: ExternalEvent): Promise<{ externalId: string; etag?: string }> {
		const msEvent = this.mapToMicrosoftEvent(event);
		const url = `${this.getBaseUrl()}/events`;

		console.log('[Microsoft Calendar] URL:', url);
		console.log('[Microsoft Calendar] Payload:', JSON.stringify(msEvent, null, 2));

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
		if (event.status === 'cancelled') {
			try {
				const cancelUrl = `${this.getBaseUrl()}/events/${encodeURIComponent(externalId)}/cancel`;
				await this.makeRequest(cancelUrl, {
					method: 'POST',
					body: JSON.stringify({
						comment: 'Event cancelled'
					})
				});
				return {};
			} catch (cancelError: any) {
				console.warn(
					'[MicrosoftCalendarProvider] POST /cancel failed (may not be an organizer meeting with attendees), falling back to PATCH:',
					cancelError?.message || cancelError
				);
			}
		}

		const msEvent = this.mapToMicrosoftEvent(event);
		const url = `${this.getBaseUrl()}/events/${encodeURIComponent(externalId)}`;
		const response = await this.makeRequest<any>(url, {
			method: 'PATCH',
			body: JSON.stringify(msEvent)
		});

		return { etag: response['@odata.etag'] };
	}

	async deleteEvent(externalId: string): Promise<void> {
		// First try to cancel the event so room attendees / resources are freed up in Exchange/365
		try {
			const cancelUrl = `${this.getBaseUrl()}/events/${encodeURIComponent(externalId)}/cancel`;
			await this.makeRequest(cancelUrl, {
				method: 'POST',
				body: JSON.stringify({
					comment: 'Event deleted'
				})
			});
		} catch {
			// If not an organizer meeting with attendees or already cancelled/deleted, ignore
		}

		const url = `${this.getBaseUrl()}/events/${encodeURIComponent(externalId)}`;

		try {
			await this.makeRequest(url, { method: 'DELETE' });
		} catch (error: any) {
			if (error?.message?.includes('404') || error?.message?.includes('ResourceNotFound') || error?.status === 404) {
				console.log(`[MicrosoftCalendarProvider] Event ${externalId} already deleted from Microsoft Calendar`);
				return;
			}
			throw error;
		}
	}

	async setupWebhook(callbackUrl: string): Promise<WebhookSubscription> {
		if (!this.config) {
			throw new Error('Provider not initialized');
		}

		// Calculate expiration date (max ~2.9 days; use 2 days = 2880 minutes)
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 2);

		const url = 'https://graph.microsoft.com/v1.0/subscriptions';

		let resource = 'me/events';
		const calId = this.calendarId;
		const mbEmail = this.client.getMailboxEmail();

		if (mbEmail) {
			resource = calId && calId !== 'primary'
				? `users/${encodeURIComponent(mbEmail)}/calendars/${encodeURIComponent(calId)}/events`
				: `users/${encodeURIComponent(mbEmail)}/events`;
		} else if (calId !== 'primary') {
			if (calId.includes('@')) {
				resource = `users/${encodeURIComponent(calId)}/events`;
			} else {
				resource = `me/calendars/${encodeURIComponent(calId)}/events`;
			}
		}

		const response = await this.client.makeRequest<any>(url, {
			method: 'POST',
			body: JSON.stringify({
				changeType: 'created,updated,deleted',
				notificationUrl: callbackUrl,
				resource,
				expirationDateTime: expiresAt.toISOString(),
				clientState: this.config.id
			})
		});

		return {
			id: crypto.randomUUID(),
			syncConfigId: this.config.id,
			providerId: this.config.providerId,
			resourceId: response.id,
			channelId: response.id,
			expiresAt: new Date(response.expirationDateTime),
			createdAt: new Date()
		} as WebhookSubscription;
	}

	async renewWebhook(subscription: WebhookSubscription): Promise<WebhookSubscription> {
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 2);

		const url = `https://graph.microsoft.com/v1.0/subscriptions/${encodeURIComponent(subscription.resourceId)}`;

		const response = await this.client.makeRequest<any>(url, {
			method: 'PATCH',
			body: JSON.stringify({
				expirationDateTime: expiresAt.toISOString()
			})
		});

		return {
			...subscription,
			expiresAt: new Date(response.expirationDateTime)
		} as WebhookSubscription;
	}

	async cancelWebhook(subscription: WebhookSubscription): Promise<void> {
		try {
			const url = `https://graph.microsoft.com/v1.0/subscriptions/${encodeURIComponent(subscription.resourceId)}`;
			await this.client.makeRequest(url, { method: 'DELETE' });
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

	private mapToExternalEvent(msEvent: any): ExternalEvent {
		const isCancelled = msEvent.isCancelled || msEvent['@removed']?.reason === 'deleted';

		const startDateTime = msEvent.start?.dateTime ? new Date(msEvent.start.dateTime + 'Z') : undefined;
		const endDateTime = msEvent.end?.dateTime ? new Date(msEvent.end.dateTime + 'Z') : undefined;

		let recurrence: string[] | undefined = undefined;
		if (msEvent.recurrence) {
			const rrule = mapMicrosoftRecurrenceToRRule(msEvent.recurrence);
			if (rrule) {
				recurrence = [rrule];
			}
		}

		return {
			externalId: msEvent.id,
			providerId: this.config?.providerId || 'microsoft-calendar',
			summary: msEvent.subject || 'Untitled Event',
			status: isCancelled
				? 'cancelled'
				: msEvent.showAs === 'tentative' ? 'tentative' : 'confirmed',
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
				responseStatus: a.status?.response,
				type: a.type
			})),
			recurrence,
			etag: msEvent['@odata.etag'],
			updatedAt: msEvent.lastModifiedDateTime ? new Date(msEvent.lastModifiedDateTime) : undefined,
			metadata: {
				app_event_id: msEvent.transactionId,
				seriesMasterId: msEvent.seriesMasterId ?? undefined,
				type: msEvent.type ?? undefined
			}
		};
	}

	private mapToMicrosoftEvent(event: ExternalEvent): any {
		let showAs = 'busy';
		if (event.status === 'tentative') {
			showAs = 'tentative';
		} else if (event.status === 'cancelled') {
			showAs = 'free';
		}

		let subject = event.summary;
		if (event.status === 'cancelled' && !subject.startsWith('[Cancelled]') && !subject.startsWith('[Abgesagt]')) {
			subject = `[Cancelled] ${subject}`;
		}

		const msEvent: any = {
			subject,
			showAs,
			body: event.description ? { contentType: 'HTML', content: event.description } : undefined,
			location: event.location ? { displayName: event.location } : undefined,
			isAllDay: event.isAllDay,
			transactionId: event.metadata?.app_event_id
		};

		const startTimeZone = event.startTimeZone || 'UTC';
		const start = event.startDateTime ? new Date(event.startDateTime) : new Date();
		msEvent.start = {
			dateTime: formatLocal(start, startTimeZone),
			timeZone: startTimeZone
		};

		const endTimeZone = event.endTimeZone || startTimeZone;
		const end = event.endDateTime
			? new Date(event.endDateTime)
			: new Date(start.getTime() + 60 * 60 * 1000);
		msEvent.end = {
			dateTime: formatLocal(end, endTimeZone),
			timeZone: endTimeZone
		};

		// Map attendees (including resource attendees)
		if (event.attendees && event.attendees.length > 0) {
			const includeRoomBookings = this.config?.settings?.includeRoomBookings !== false && (this.config?.settings?.autoBookOnCalendar !== false);
			const eligibleAttendees = includeRoomBookings
				? event.attendees
				: event.attendees.filter((a) => a.type !== 'resource');

			if (eligibleAttendees.length > 0) {
				msEvent.attendees = eligibleAttendees.map((a) => ({
					emailAddress: { address: a.email, name: a.displayName },
					type: a.type || 'required'
				}));
			}

			if (includeRoomBookings) {
				// Map conference room locations for Exchange room booking
				const roomAttendees = event.attendees.filter((a) => a.type === 'resource' && a.email?.includes('@'));
				if (roomAttendees.length > 0) {
					msEvent.locations = roomAttendees.map((r) => ({
						displayName: r.displayName || r.email,
						locationEmailAddress: r.email,
						locationType: 'conferenceRoom'
					}));
					if (!msEvent.location && roomAttendees.length === 1) {
						msEvent.location = {
							displayName: roomAttendees[0].displayName || roomAttendees[0].email,
							locationEmailAddress: roomAttendees[0].email,
							locationType: 'conferenceRoom'
						};
					}
				}
			}
		}

		if (event.recurrence && event.recurrence.length > 0) {
			const recurrence = mapRRuleToMicrosoftRecurrence(event.recurrence[0], start, startTimeZone);
			if (recurrence) {
				msEvent.recurrence = recurrence;
			}
		} else if (event.recurrence !== undefined && event.recurrence.length === 0) {
			msEvent.recurrence = null;
		}

		return msEvent;
	}
}
