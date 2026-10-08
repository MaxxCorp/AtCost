import type {
	SyncProvider,
	SyncConfig,
	ExternalEvent,
	WebhookSubscription,
	ProviderType,
	SyncDirection
} from '../types';

import {
	MICROSOFT_TENANT_ID,
	MICROSOFT_CLIENT_ID,
	MICROSOFT_CLIENT_SECRET
} from '$app/env/private';

import { db } from '@ac/db';
import { account } from '@ac/db';
import { eq, and } from '@ac/db';
import { RRule } from '#lib/utils/rrule-compat.js';

const RRULE_WEEKDAY_TO_GRAPH: Record<number, string> = {
	0: 'monday',
	1: 'tuesday',
	2: 'wednesday',
	3: 'thursday',
	4: 'friday',
	5: 'saturday',
	6: 'sunday'
};

const GRAPH_DAY_TO_RRULE: Record<string, string> = {
	monday: 'MO',
	tuesday: 'TU',
	wednesday: 'WE',
	thursday: 'TH',
	friday: 'FR',
	saturday: 'SA',
	sunday: 'SU'
};

export class MicrosoftCalendarProvider implements SyncProvider {
	readonly type: ProviderType = 'microsoft-calendar';
	readonly name = 'Microsoft Calendar';
	readonly supportsWebhooks = true;
	readonly supportedDirections: SyncDirection[] = ['pull', 'push', 'bidirectional'];
	readonly supportedEntityTypes: ('event' | 'announcement')[] = ['event'];
	readonly supportsNativeRecurrence = true;

	shouldSyncEvent(event: any): boolean {
		// Microsoft Calendar allows syncing of all events (including tentative and non-public)
		return true;
	}

	private config?: SyncConfig;
	private accessToken?: string;
	private refreshToken?: string;
	private calendarId = 'primary';

	async initialize(config: SyncConfig): Promise<void> {
		this.config = config;

		if (config.settings?.calendarId !== undefined && config.settings?.calendarId !== null) {
			const trimmed = String(config.settings.calendarId).trim();
			this.calendarId = trimmed !== '' ? trimmed : 'primary';
		} else {
			this.calendarId = 'primary';
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

	/**
	 * Validates that the specified calendar is available and accessible.
	 * Throws an explicit error if the calendar is not found or is inaccessible.
	 * Never falls back to other calendars.
	 */
	async validateCalendarAccess(): Promise<void> {
		if (!this.accessToken) throw new Error('Provider not initialized');

		const url = this.getBaseUrl();
		try {
			await this.makeRequest(url, { method: 'GET' });
		} catch (error: any) {
			const target = this.calendarId === 'primary' ? 'primary calendar' : `calendar "${this.calendarId}"`;
			console.error(`[MicrosoftCalendarProvider] Specified ${target} is not available:`, error);
			throw new Error(`Microsoft Calendar sync failed: Specified ${target} is not available or accessible (${error?.message || error}).`);
		}
	}

	async validateConnection(): Promise<boolean> {
		if (!this.accessToken) throw new Error('Provider not initialized');

		try {
			await this.validateCalendarAccess();
			return true;
		} catch (error) {
			console.error('Microsoft Calendar connection validation failed:', error);
			return false;
		}
	}

	private getBaseUrl(): string {
		if (this.calendarId === 'primary') {
			return 'https://graph.microsoft.com/v1.0/me/calendar';
		}
		if (this.calendarId.includes('@')) {
			return `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(this.calendarId)}/calendar`;
		}
		return `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(this.calendarId)}`;
	}

	async pullEvents(syncToken?: string): Promise<{
		events: ExternalEvent[];
		nextSyncToken?: string;
	}> {
		if (!this.accessToken) throw new Error('Provider not initialized');

		// Validate that the specified calendar is accessible before pulling
		if (!syncToken) {
			await this.validateCalendarAccess();
		}

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

		const events: ExternalEvent[] = allEvents.map((e) => this.mapToExternalEvent(e));

		return {
			events,
			nextSyncToken: deltaLink
		};
	}

	async pushEvent(event: ExternalEvent): Promise<{ externalId: string; etag?: string }> {
		if (!this.accessToken) throw new Error('Provider not initialized');

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
		if (!this.accessToken) throw new Error('Provider not initialized');

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
		const response = await this.makeRequest<any>(url, { method: 'PATCH', body: JSON.stringify(msEvent) });

		return { etag: response['@odata.etag'] };
	}

	async deleteEvent(externalId: string): Promise<void> {
		if (!this.accessToken) throw new Error('Provider not initialized');

		// First try to cancel the event so room attendees / resources are freed up in Exchange/365
		try {
			const cancelUrl = `${this.getBaseUrl()}/events/${encodeURIComponent(externalId)}/cancel`;
			await this.makeRequest(cancelUrl, {
				method: 'POST',
				body: JSON.stringify({
					comment: 'Event deleted'
				})
			});
		} catch (cancelError: any) {
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
		if (!this.accessToken || !this.config) {
			throw new Error('Provider not initialized');
		}

		// Calculate expiration date (max 4230 minutes = ~2.9 days)
		// We'll use 2 days (2880 minutes) to be safe
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 2);

		const url = 'https://graph.microsoft.com/v1.0/subscriptions';
        
		let resource = 'me/events';
		if (this.calendarId !== 'primary') {
			if (this.calendarId.includes('@')) {
				resource = `users/${encodeURIComponent(this.calendarId)}/events`;
			} else {
				resource = `me/calendars/${encodeURIComponent(this.calendarId)}/events`;
			}
		}

		const response = await this.makeRequest<any>(url, {
			method: 'POST',
			body: JSON.stringify({
				changeType: 'created,updated,deleted',
				notificationUrl: callbackUrl,
				resource,
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

		const tenantId = MICROSOFT_TENANT_ID || 'common';
		const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				client_id: MICROSOFT_CLIENT_ID || '',
				client_secret: MICROSOFT_CLIENT_SECRET || '',
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
				accessTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
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
		const isCancelled = msEvent.isCancelled || msEvent['@removed']?.reason === 'deleted';

		const startDateTime = msEvent.start?.dateTime ? new Date(msEvent.start.dateTime + 'Z') : undefined;
		const endDateTime = msEvent.end?.dateTime ? new Date(msEvent.end.dateTime + 'Z') : undefined;

		let recurrence: string[] | undefined = undefined;
		if (msEvent.recurrence) {
			const rrule = this.mapMicrosoftRecurrenceToRRule(msEvent.recurrence);
			if (rrule) {
				recurrence = [rrule];
			}
		}

		return {
			externalId: msEvent.id,
			providerId: (this.config!).providerId,
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
				responseStatus: a.status?.response
			})),
			recurrence,
			etag: msEvent['@odata.etag'],
			updatedAt: msEvent.lastModifiedDateTime ? new Date(msEvent.lastModifiedDateTime) : undefined,
			metadata: {
				app_event_id: msEvent.transactionId, // we'll use transactionId to store internal id to prevent echoes
				seriesMasterId: msEvent.seriesMasterId ?? undefined,
				type: msEvent.type ?? undefined
			}
		};
	}

	private formatLocal(date: Date, timeZone: string): string {
		try {
			const parts = new Intl.DateTimeFormat('en-US', {
				timeZone,
				year: 'numeric', month: '2-digit', day: '2-digit',
				hour: '2-digit', minute: '2-digit', second: '2-digit',
				hour12: false
			}).formatToParts(date);
			
			const p: Record<string, string> = {};
			for (const part of parts) p[part.type] = part.value;
			
			if (p.hour === '24') p.hour = '00';
			
			return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
		} catch (e) {
			return date.toISOString().split('.')[0];
		}
	}

	private getDayOfWeekInTimeZone(date: Date, timeZone: string): string {
		try {
			return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).format(date).toLowerCase();
		} catch {
			const jsDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
			return jsDays[date.getUTCDay()];
		}
	}

	private getDayOfMonthInTimeZone(date: Date, timeZone: string): number {
		try {
			const val = parseInt(new Intl.DateTimeFormat('en-US', { timeZone, day: 'numeric' }).format(date), 10);
			return isNaN(val) ? date.getUTCDate() : val;
		} catch {
			return date.getUTCDate();
		}
	}

	private getMonthInTimeZone(date: Date, timeZone: string): number {
		try {
			const val = parseInt(new Intl.DateTimeFormat('en-US', { timeZone, month: 'numeric' }).format(date), 10);
			return isNaN(val) ? date.getUTCMonth() + 1 : val;
		} catch {
			return date.getUTCMonth() + 1;
		}
	}

	private mapPositionToIndex(pos?: number): 'first' | 'second' | 'third' | 'fourth' | 'last' {
		if (pos === 1) return 'first';
		if (pos === 2) return 'second';
		if (pos === 3) return 'third';
		if (pos === 4) return 'fourth';
		if (pos === -1 || pos === 5) return 'last';
		return 'first';
	}

	private mapIndexToPosition(index?: string): number | null {
		switch (index?.toLowerCase()) {
			case 'first': return 1;
			case 'second': return 2;
			case 'third': return 3;
			case 'fourth': return 4;
			case 'last': return -1;
			default: return null;
		}
	}

	private mapRRuleToMicrosoftRecurrence(rruleStr: string, start: Date, startTimeZone: string): any {
		try {
			const firstLine = rruleStr.split(/\r?\n/)[0].trim();
			const cleanStr = firstLine.replace(/^RRULE:/i, '').trim();
			const options = RRule.parseString(cleanStr);

			const startDate = this.formatLocal(start, startTimeZone).split('T')[0];
			const range: any = {
				startDate,
				recurrenceTimeZone: startTimeZone
			};

			if (options.until) {
				range.type = 'endDate';
				const endDate = this.formatLocal(new Date(options.until), startTimeZone).split('T')[0];
				range.endDate = endDate < startDate ? startDate : endDate;
			} else if (options.count && typeof options.count === 'number' && options.count > 0) {
				range.type = 'numbered';
				range.numberOfOccurrences = options.count;
			} else {
				range.type = 'noEnd';
			}

			const interval = options.interval || 1;
			const pattern: any = { interval };

			const byweekday = options.byweekday
				? Array.isArray(options.byweekday) ? options.byweekday : [options.byweekday]
				: [];
			const daysOfWeek = byweekday.map((w: any) => {
				const num = typeof w === 'number' ? w : w.weekday;
				return RRULE_WEEKDAY_TO_GRAPH[num];
			}).filter(Boolean);

			const wkstObj = options.wkst;
			const wkstNum = typeof wkstObj === 'object' && wkstObj !== null ? wkstObj.weekday : wkstObj;
			const firstDayOfWeek = wkstNum !== undefined && wkstNum !== null && RRULE_WEEKDAY_TO_GRAPH[wkstNum] ? RRULE_WEEKDAY_TO_GRAPH[wkstNum] : 'sunday';
			const isRelative = byweekday.some((w: any) => typeof w !== 'number' && w.n !== undefined) || options.bysetpos !== null && options.bysetpos !== undefined;
			let pos: number | undefined = undefined;
			if (options.bysetpos !== null && options.bysetpos !== undefined) {
				pos = Array.isArray(options.bysetpos) ? options.bysetpos[0] : options.bysetpos;
			} else if (byweekday.length > 0 && typeof byweekday[0] !== 'number' && byweekday[0].n !== undefined) {
				pos = byweekday[0].n;
			}

			switch (options.freq) {
				case 3: // DAILY
					pattern.type = 'daily';
					break;
				case 2: // WEEKLY
					pattern.type = 'weekly';
					pattern.daysOfWeek = daysOfWeek.length > 0 ? daysOfWeek : [this.getDayOfWeekInTimeZone(start, startTimeZone)];
					pattern.firstDayOfWeek = firstDayOfWeek;
					break;
				case 1: // MONTHLY
					if (isRelative) {
						pattern.type = 'relativeMonthly';
						pattern.daysOfWeek = daysOfWeek.length > 0 ? daysOfWeek : [this.getDayOfWeekInTimeZone(start, startTimeZone)];
						pattern.index = this.mapPositionToIndex(pos);
					} else {
						pattern.type = 'absoluteMonthly';
						pattern.dayOfMonth = options.bymonthday
							? Array.isArray(options.bymonthday) ? options.bymonthday[0] : options.bymonthday
							: this.getDayOfMonthInTimeZone(start, startTimeZone);
					}
					break;
				case 0: // YEARLY
					if (isRelative) {
						pattern.type = 'relativeYearly';
						pattern.daysOfWeek = daysOfWeek.length > 0 ? daysOfWeek : [this.getDayOfWeekInTimeZone(start, startTimeZone)];
						pattern.index = this.mapPositionToIndex(pos);
						pattern.month = options.bymonth
							? Array.isArray(options.bymonth) ? options.bymonth[0] : options.bymonth
							: this.getMonthInTimeZone(start, startTimeZone);
					} else {
						pattern.type = 'absoluteYearly';
						pattern.dayOfMonth = options.bymonthday
							? Array.isArray(options.bymonthday) ? options.bymonthday[0] : options.bymonthday
							: this.getDayOfMonthInTimeZone(start, startTimeZone);
						pattern.month = options.bymonth
							? Array.isArray(options.bymonth) ? options.bymonth[0] : options.bymonth
							: this.getMonthInTimeZone(start, startTimeZone);
					}
					break;
				default:
					return undefined;
			}

			return { pattern, range };
		} catch (e) {
			console.warn('[MicrosoftCalendarProvider] Failed to parse recurrence rule:', rruleStr, e);
			return undefined;
		}
	}

	private mapMicrosoftRecurrenceToRRule(recurrence: any): string | undefined {
		const pattern = recurrence?.pattern;
		const range = recurrence?.range;
		if (!pattern) return undefined;

		const parts: string[] = [];

		switch (pattern.type?.toLowerCase()) {
			case 'daily':
				parts.push('FREQ=DAILY');
				break;
			case 'weekly':
				parts.push('FREQ=WEEKLY');
				if (pattern.daysOfWeek && Array.isArray(pattern.daysOfWeek) && pattern.daysOfWeek.length > 0) {
					const days = pattern.daysOfWeek
						.map((d: string) => GRAPH_DAY_TO_RRULE[d.toLowerCase()])
						.filter(Boolean);
					if (days.length > 0) {
						parts.push(`BYDAY=${days.join(',')}`);
					}
				}
				if (pattern.firstDayOfWeek) {
					const wkst = GRAPH_DAY_TO_RRULE[pattern.firstDayOfWeek.toLowerCase()];
					if (wkst) parts.push(`WKST=${wkst}`);
				}
				break;
			case 'absolutemonthly':
				parts.push('FREQ=MONTHLY');
				if (pattern.dayOfMonth) {
					parts.push(`BYMONTHDAY=${pattern.dayOfMonth}`);
				}
				break;
			case 'relativemonthly': {
					parts.push('FREQ=MONTHLY');
					const pos = this.mapIndexToPosition(pattern.index);
				const days = (pattern.daysOfWeek || [])
					.map((d: string) => GRAPH_DAY_TO_RRULE[d.toLowerCase()])
					.filter(Boolean);
					if (days.length === 1 && pos !== null) {
						parts.push(`BYDAY=${pos}${days[0]}`);
					} else if (days.length > 0) {
						parts.push(`BYDAY=${days.join(',')}`);
						if (pos !== null) parts.push(`BYSETPOS=${pos}`);
					}
					break;
				}
			case 'absoluteyearly':
				parts.push('FREQ=YEARLY');
				if (pattern.month) {
					parts.push(`BYMONTH=${pattern.month}`);
				}
				if (pattern.dayOfMonth) {
					parts.push(`BYMONTHDAY=${pattern.dayOfMonth}`);
				}
				break;
			case 'relativeyearly': {
					parts.push('FREQ=YEARLY');
					if (pattern.month) {
						parts.push(`BYMONTH=${pattern.month}`);
					}
					const pos = this.mapIndexToPosition(pattern.index);
				const days = (pattern.daysOfWeek || [])
					.map((d: string) => GRAPH_DAY_TO_RRULE[d.toLowerCase()])
					.filter(Boolean);
					if (days.length === 1 && pos !== null) {
						parts.push(`BYDAY=${pos}${days[0]}`);
					} else if (days.length > 0) {
						parts.push(`BYDAY=${days.join(',')}`);
						if (pos !== null) parts.push(`BYSETPOS=${pos}`);
					}
					break;
				}
			default:
				return undefined;
		}

		if (pattern.interval && pattern.interval > 1) {
			parts.push(`INTERVAL=${pattern.interval}`);
		}

		if (range) {
			if (range.type === 'endDate' && range.endDate) {
				const cleanEnd = range.endDate.replace(/-/g, '');
				parts.push(`UNTIL=${cleanEnd}T235959Z`);
			} else if (range.type === 'numbered' && range.numberOfOccurrences) {
				parts.push(`COUNT=${range.numberOfOccurrences}`);
			}
		}

		return `RRULE:${parts.join(';')}`;
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
			transactionId: event.metadata?.app_event_id // Use transactionId for tracking our own ID
		};

		const startTimeZone = event.startTimeZone || 'UTC';
		const start = event.startDateTime ? new Date(event.startDateTime) : new Date();
		msEvent.start = {
			dateTime: this.formatLocal(start, startTimeZone),
			timeZone: startTimeZone
		};

		const endTimeZone = event.endTimeZone || startTimeZone;
		const end = event.endDateTime
			? new Date(event.endDateTime)
			: new Date(start.getTime() + 60 * 60 * 1000);
		msEvent.end = {
			dateTime: this.formatLocal(end, endTimeZone),
			timeZone: endTimeZone
		};

		if (event.attendees && event.attendees.length > 0) {
			msEvent.attendees = event.attendees.map((a) => ({
				emailAddress: { address: a.email, name: a.displayName },
				type: a.type || 'required'
			}));
		}

		if (event.recurrence && event.recurrence.length > 0) {
			const recurrence = this.mapRRuleToMicrosoftRecurrence(event.recurrence[0], start, startTimeZone);
			if (recurrence) {
				msEvent.recurrence = recurrence;
			}
		} else if (event.recurrence !== undefined && event.recurrence.length === 0) {
			msEvent.recurrence = null;
		}

		return msEvent;
	}
}
