import type {
	SyncProvider,
	SyncConfig,
	ExternalEvent,
	ProviderType,
	SyncDirection
} from '../../types';

import { MicrosoftGraphClient, type MicrosoftRoom } from './client';
import { db, resource, syncMapping, eq, and } from '@ac/db';
import { formatLocal } from './recurrence';

export interface RoomBookingResult {
	success: boolean;
	bookingId?: string;
	status: 'confirmed' | 'conflict' | 'error';
	message?: string;
	roomEmail: string;
	roomName: string;
}

export class MicrosoftResourceProvider implements SyncProvider {
	readonly type: ProviderType = 'microsoft-resources';
	readonly name = 'Microsoft Resources';
	readonly supportsWebhooks = false;
	readonly supportedDirections: SyncDirection[] = ['pull', 'push', 'bidirectional'];
	readonly supportedEntityTypes: ('event' | 'announcement')[] = [];

	private client = new MicrosoftGraphClient();
	private config?: SyncConfig;

	async initialize(config: SyncConfig): Promise<void> {
		this.config = config;
		await this.client.initialize(config);
	}

	getClient(): MicrosoftGraphClient {
		return this.client;
	}

	get accessToken(): string | undefined {
		return (this.client as any).accessToken;
	}
	set accessToken(val: string | undefined) {
		(this.client as any).accessToken = val;
	}

	async listRooms(): Promise<MicrosoftRoom[]> {
		return this.client.listRooms();
	}

	async checkRoomAvailability(
		emails: string[],
		start: Date,
		end: Date
	): Promise<Map<string, any>> {
		return this.client.checkRoomAvailability(emails, start, end);
	}

	async validateConnection(): Promise<boolean> {
		try {
			const res = await this.client.testResourcesTarget();
			return res.success;
		} catch (error) {
			console.error('Microsoft Resources connection validation failed:', error);
			return false;
		}
	}

	/**
	 * Pull / Discover rooms from Microsoft Graph into the internal resource table
	 */
	async pullResources(userId?: string): Promise<{ count: number; rooms: MicrosoftRoom[] }> {
		const rooms = await this.client.listRooms();
		const effectiveUserId = userId || this.config?.userId;

		if (effectiveUserId && rooms.length > 0) {
			for (const r of rooms) {
				const existing = await db
					.select()
					.from(resource)
					.where(eq(resource.name, r.name))
					.limit(1);

				const allocationCalendars = [
					{
						provider: 'microsoft-calendar',
						calendarId: r.email,
						name: r.name
					}
				];

				if (existing.length === 0) {
					const [newRes] = await db.insert(resource).values({
						userId: effectiveUserId,
						name: r.name,
						type: r.type || 'room',
						maxOccupancy: r.capacity || null,
						description: `Microsoft 365 Room Mailbox (${r.email})${r.building ? ` in ${r.building}` : ''}`,
						allocationCalendars: JSON.stringify(allocationCalendars)
					}).returning();

					if (newRes && this.config) {
						await db.insert(syncMapping).values({
							syncConfigId: this.config.id,
							resourceId: newRes.id,
							externalId: r.email,
							providerId: 'microsoft-resources'
						});
					}
				} else if (existing[0]) {
					// Ensure allocation calendar has room email
					await db.update(resource).set({
						allocationCalendars: JSON.stringify(allocationCalendars),
						updatedAt: new Date()
					}).where(eq(resource.id, existing[0].id));
				}
			}
		}

		return { count: rooms.length, rooms };
	}

	/**
	 * Check availability of rooms for a specific time range
	 */
	async checkAvailability(
		roomEmails: string[],
		start: Date,
		end: Date
	) {
		return await this.client.checkRoomAvailability(roomEmails, start, end);
	}

	/**
	 * Book / Reserve a room directly in Microsoft 365
	 */
	async bookRoom(options: {
		eventId?: string;
		resourceId?: string;
		roomEmail: string;
		roomName?: string;
		summary?: string;
		description?: string;
		start?: Date;
		end?: Date;
		startDateTime?: Date;
		endDateTime?: Date;
		subject?: string;
		startTimeZone?: string;
		endTimeZone?: string;
		organizerName?: string;
		organizerEmail?: string;
	}): Promise<RoomBookingResult> {
		const {
			eventId,
			resourceId,
			roomEmail,
			startTimeZone = 'UTC',
			endTimeZone = 'UTC',
			organizerName,
			organizerEmail
		} = options;

		const roomName = options.roomName || roomEmail;
		const summary = options.summary || options.subject || `Booking for ${roomName}`;
		const description = options.description || '';
		const start = options.start || options.startDateTime || new Date();
		const end = options.end || options.endDateTime || new Date(start.getTime() + 60 * 60 * 1000);

		if (!roomEmail || !roomEmail.includes('@')) {
			return {
				success: false,
				status: 'error',
				roomEmail,
				roomName,
				message: `Invalid room email address "${roomEmail}" for room "${roomName}".`
			};
		}

		// 1. Verify availability
		try {
			const availMap = await this.client.checkRoomAvailability([roomEmail], start, end);
			const avail = availMap.get(roomEmail.toLowerCase());

			if (avail && !avail.isAvailable) {
				return {
					success: false,
					status: 'conflict',
					roomEmail,
					roomName,
					message: `Room "${roomName}" (${roomEmail}) has a conflict during this time: ${avail.conflictMessage || 'Already booked'}.`
				};
			}
		} catch (availErr: any) {
			console.warn(`[MicrosoftResourceProvider] Availability check warning for ${roomEmail}:`, availErr.message);
		}

		// 2. Create meeting on room calendar or invite room
		try {
			const bookUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(roomEmail)}/calendar/events`;

			const body: any = {
				subject: summary || `Booking for ${roomName}`,
				body: {
					contentType: 'HTML',
					content: description || `Resource booking for event ${summary} (${eventId || 'direct'})`
				},
				start: {
					dateTime: formatLocal(start, startTimeZone),
					timeZone: startTimeZone
				},
				end: {
					dateTime: formatLocal(end, endTimeZone),
					timeZone: endTimeZone
				},
				location: {
					displayName: roomName,
					locationEmailAddress: roomEmail,
					locationType: 'conferenceRoom'
				},
				showAs: 'busy'
			};

			if (organizerEmail && organizerEmail.includes('@')) {
				body.attendees = [
					{
						emailAddress: {
							address: organizerEmail,
							name: organizerName || organizerEmail
						},
						type: 'required'
					}
				];
			}

			const response = await this.client.makeRequest<any>(bookUrl, {
				method: 'POST',
				body: JSON.stringify(body)
			});

			// 3. Track mapping in sync_mapping
			if (this.config && response?.id && eventId && resourceId) {
				await db.insert(syncMapping).values({
					syncConfigId: this.config.id,
					eventId,
					resourceId,
					externalId: response.id,
					providerId: 'microsoft-resources',
					metadata: {
						roomEmail,
						roomName,
						bookedAt: new Date().toISOString()
					}
				});
			}

			return {
				success: true,
				bookingId: response?.id,
				status: 'confirmed',
				roomEmail,
				roomName,
				message: `Successfully booked room "${roomName}" (${roomEmail}) on Microsoft 365 (Booking ID: ${response?.id}).`
			};
		} catch (err: any) {
			console.error(`[MicrosoftResourceProvider] Failed to book room "${roomName}" (${roomEmail}):`, err);
			return {
				success: false,
				status: 'error',
				roomEmail,
				roomName,
				message: `Failed to book room "${roomName}" (${roomEmail}): ${err.message || String(err)}`
			};
		}
	}

	/**
	 * Release / Cancel room booking for an event
	 */
	async releaseRoom(roomEmailOrEventId: string, bookingIdOrResourceId: string): Promise<void> {
		if (roomEmailOrEventId.includes('@')) {
			// Direct release by room email and booking ID
			const roomEmail = roomEmailOrEventId;
			const bookingId = bookingIdOrResourceId;
			const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(roomEmail)}/calendar/events/${encodeURIComponent(bookingId)}`;
			try {
				await this.client.makeRequest(url, { method: 'DELETE' });
			} catch (err: any) {
				if (err?.status !== 404) {
					console.warn(`[MicrosoftResourceProvider] Failed to delete booking ${bookingId} on ${roomEmail}:`, err.message);
				}
			}
			return;
		}

		if (!this.config) return;

		const mappings = await db
			.select()
			.from(syncMapping)
			.where(and(
				eq(syncMapping.eventId, roomEmailOrEventId),
				eq(syncMapping.resourceId, bookingIdOrResourceId),
				eq(syncMapping.syncConfigId, this.config.id)
			));

		for (const m of mappings) {
			const roomEmail = (m.metadata as any)?.roomEmail;
			const externalId = m.externalId;
			if (roomEmail && externalId) {
				const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(roomEmail)}/calendar/events/${encodeURIComponent(externalId)}`;
				try {
					await this.client.makeRequest(url, { method: 'DELETE' });
				} catch (err: any) {
					if (err?.status !== 404) {
						console.warn(`[MicrosoftResourceProvider] Failed to cancel room booking ${externalId} on ${roomEmail}:`, err.message);
					}
				}
			}
			await db.delete(syncMapping).where(eq(syncMapping.id, m.id));
		}
	}

	// Stubs for general SyncProvider contract
	async pullEvents(): Promise<{ events: ExternalEvent[]; nextSyncToken?: string }> {
		return { events: [] };
	}

	async pushEvent(): Promise<{ externalId: string }> {
		throw new Error('MicrosoftResourceProvider does not sync events directly; use bookRoom instead.');
	}

	async updateEvent(): Promise<{ etag?: string }> {
		return {};
	}

	async deleteEvent(): Promise<void> {
		// No-op
	}
}
