import type {
	SyncProvider,
	SyncConfig,
	ExternalEvent,
	ProviderType,
	SyncDirection
} from '../../types';

import { MicrosoftGraphClient, type MicrosoftRoom } from './client';
import { db, resource, syncMapping, eq, and } from '@ac/db';
import { formatLocal, mapRRuleToMicrosoftRecurrence, parseGraphDateTime } from './recurrence';

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
	 * Delete a calendar event directly from a room's mailbox, ignoring 404 responses.
	 */
	private async deleteRoomCalendarEvent(roomEmail: string, bookingId: string): Promise<void> {
		const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(roomEmail)}/calendar/events/${encodeURIComponent(bookingId)}`;
		try {
			await this.client.makeRequest(url, { method: 'DELETE' });
		} catch (err: any) {
			const is404 =
				err?.status === 404 ||
				err?.code === 404 ||
				err?.message?.includes('404') ||
				err?.message?.includes('ResourceNotFound');
			if (!is404) {
				console.warn(`[MicrosoftResourceProvider] Failed to delete booking ${bookingId} on ${roomEmail}:`, err.message);
			}
		}
	}

	/**
	 * Check the room's calendarView for conflicting bookings while excluding the current
	 * event's own booking IDs / transactionId.
	 */
	private async checkConflictsExcludingSelf(
		roomEmail: string,
		start: Date,
		end: Date,
		ignoreExternalIds: Set<string>,
		ignoreTransactionId?: string
	): Promise<{ isAvailable: boolean; conflictMessage?: string; matchedExternalId?: string }> {
		try {
			const url =
				`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(roomEmail)}/calendarView` +
				`?startDateTime=${encodeURIComponent(start.toISOString())}` +
				`&endDateTime=${encodeURIComponent(end.toISOString())}` +
				`&$select=id,subject,start,end,showAs,isCancelled,transactionId`;

			const res = await this.client.makeRequest<any>(url, {
				method: 'GET',
				headers: { Prefer: 'outlook.timezone="UTC"' }
			});

			const items: any[] = Array.isArray(res?.value) ? res.value : [];
			const conflicts: any[] = [];
			let matchedExternalId: string | undefined;

			for (const e of items) {
				if (!e) continue;
				if (e.isCancelled === true || String(e.showAs || '').toLowerCase() === 'free') {
					continue;
				}
				const eStart = parseGraphDateTime(e.start?.dateTime, e.start?.timeZone ?? 'UTC');
				const eEnd = parseGraphDateTime(e.end?.dateTime, e.end?.timeZone ?? 'UTC');
				if (eStart && eEnd && (eStart >= end || eEnd <= start)) {
					continue;
				}
				if (e.id && ignoreExternalIds.has(e.id)) {
					continue;
				}
				if (ignoreTransactionId && e.transactionId === ignoreTransactionId) {
					if (e.id) matchedExternalId = e.id;
					continue;
				}
				conflicts.push(e);
			}

			if (conflicts.length > 0) {
				return {
					isAvailable: false,
					matchedExternalId,
					conflictMessage: `Room has ${conflicts.length} conflict(s) (${conflicts.map((c) => `${c.subject || 'Busy'}: ${c.start?.dateTime || ''} - ${c.end?.dateTime || ''}`).join(', ')})`
				};
			}

			return { isAvailable: true, matchedExternalId };
		} catch (err: any) {
			console.warn(`[MicrosoftResourceProvider] calendarView conflict check warning for ${roomEmail}:`, err?.message || err);
			return { isAvailable: true };
		}
	}

	/**
	 * Book / Reserve (or update an existing reservation for) a room directly in Microsoft 365
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
		isAllDay?: boolean;
		recurrence?: string[];
		organizerName?: string;
		organizerEmail?: string;
	}): Promise<RoomBookingResult> {
		const {
			eventId,
			resourceId,
			roomEmail,
			organizerName,
			organizerEmail
		} = options;

		const startTimeZone = options.startTimeZone || 'UTC';
		const endTimeZone = options.endTimeZone || startTimeZone;
		const roomName = options.roomName || roomEmail;
		const summary = options.summary || options.subject || `Booking for ${roomName}`;
		const description = options.description || '';
		const rawStart = options.start ?? options.startDateTime;
		const start = rawStart ? new Date(rawStart) : new Date();
		const rawEnd = options.end ?? options.endDateTime;
		const end = rawEnd ? new Date(rawEnd) : new Date(start.getTime() + 60 * 60 * 1000);

		if (!roomEmail || !roomEmail.includes('@')) {
			return {
				success: false,
				status: 'error',
				roomEmail,
				roomName,
				message: `Invalid room email address "${roomEmail}" for room "${roomName}".`
			};
		}

		const transactionId = eventId
			? (resourceId ? `mp-room-${eventId}-${resourceId}` : `mp-room-${eventId}`)
			: undefined;

		const baseBody: any = {
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

		if (options.isAllDay !== undefined) {
			baseBody.isAllDay = options.isAllDay;
		}
		if (transactionId) {
			baseBody.transactionId = transactionId;
		}
		if (options.recurrence && options.recurrence.length > 0) {
			const mappedRecurrence = mapRRuleToMicrosoftRecurrence(options.recurrence[0], start, startTimeZone);
			if (mappedRecurrence) {
				baseBody.recurrence = mappedRecurrence;
			}
		}
		if (organizerEmail && organizerEmail.includes('@')) {
			baseBody.attendees = [
				{
					emailAddress: {
						address: organizerEmail,
						name: organizerName || organizerEmail
					},
					type: 'required'
				}
			];
		}

		const buildPatchBody = () => {
			const patchBody = { ...baseBody };
			if (options.recurrence !== undefined && options.recurrence.length === 0) {
				patchBody.recurrence = null;
			}
			return patchBody;
		};

		const mappingMetadata = {
			roomEmail,
			roomName,
			bookedAt: new Date().toISOString(),
			start: start.toISOString(),
			end: end.toISOString()
		};

		try {
			// 1. Check for existing sync_mapping for this (config, event, resource)
			let existingMapping: typeof syncMapping.$inferSelect | undefined;
			const canTrackMapping = Boolean(this.config && eventId && resourceId && !eventId.includes('_inst_'));

			if (canTrackMapping) {
				const existingRows = await db
					.select()
					.from(syncMapping)
					.where(and(
						eq(syncMapping.syncConfigId, this.config!.id),
						eq(syncMapping.eventId, eventId!),
						eq(syncMapping.resourceId, resourceId!)
					));

				if (Array.isArray(existingRows) && existingRows.length > 0) {
					if (existingRows.length > 1) {
						for (const dup of existingRows.slice(1)) {
							const dupRoomEmail = (dup.metadata as any)?.roomEmail;
							if (dupRoomEmail && dup.externalId) {
								await this.deleteRoomCalendarEvent(dupRoomEmail, dup.externalId);
							}
							await db.delete(syncMapping).where(eq(syncMapping.id, dup.id));
						}
					}

					existingMapping = existingRows[0];
					const prevRoomEmail = (existingMapping.metadata as any)?.roomEmail;
					if (prevRoomEmail && prevRoomEmail.toLowerCase() !== roomEmail.toLowerCase()) {
						if (existingMapping.externalId) {
							await this.deleteRoomCalendarEvent(prevRoomEmail, existingMapping.externalId);
						}
						await db.delete(syncMapping).where(eq(syncMapping.id, existingMapping.id));
						existingMapping = undefined;
					}
				}
			}

			// 2. Update path: PATCH existing booking if mapping exists for the same room
			if (existingMapping?.externalId) {
				const avail = await this.checkConflictsExcludingSelf(
					roomEmail,
					start,
					end,
					new Set([existingMapping.externalId]),
					transactionId
				);

				if (!avail.isAvailable) {
					return {
						success: false,
						status: 'conflict',
						roomEmail,
						roomName,
						message: `Room "${roomName}" (${roomEmail}) has a conflict during this time: ${avail.conflictMessage || 'Already booked'}.`
					};
				}

				const patchUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(roomEmail)}/calendar/events/${encodeURIComponent(existingMapping.externalId)}`;
				try {
					await this.client.makeRequest<any>(patchUrl, {
						method: 'PATCH',
						body: JSON.stringify(buildPatchBody())
					});

					await db.update(syncMapping).set({
						lastSyncedAt: new Date(),
						metadata: mappingMetadata
					}).where(eq(syncMapping.id, existingMapping.id));

					return {
						success: true,
						bookingId: existingMapping.externalId,
						status: 'confirmed',
						roomEmail,
						roomName,
						message: `Successfully updated room booking "${roomName}" (${roomEmail}) on Microsoft 365 (Booking ID: ${existingMapping.externalId}).`
					};
				} catch (patchErr: any) {
					const is404 =
						patchErr?.status === 404 ||
						patchErr?.code === 404 ||
						patchErr?.message?.includes('404') ||
						patchErr?.message?.includes('ResourceNotFound');
					if (!is404) {
						throw patchErr;
					}
					await db.delete(syncMapping).where(eq(syncMapping.id, existingMapping.id));
					existingMapping = undefined;
				}
			}

			// 3. Create path: Verify availability via getSchedule
			let matchedExternalId: string | undefined;
			try {
				const availMap = await this.client.checkRoomAvailability([roomEmail], start, end);
				const avail = availMap.get(roomEmail.toLowerCase());

				if (avail && !avail.isAvailable) {
					if (eventId && transactionId) {
						const selfCheck = await this.checkConflictsExcludingSelf(
							roomEmail,
							start,
							end,
							new Set(),
							transactionId
						);
						if (selfCheck.isAvailable && selfCheck.matchedExternalId) {
							matchedExternalId = selfCheck.matchedExternalId;
						} else {
							return {
								success: false,
								status: 'conflict',
								roomEmail,
								roomName,
								message: `Room "${roomName}" (${roomEmail}) has a conflict during this time: ${selfCheck.conflictMessage || avail.conflictMessage || 'Already booked'}.`
							};
						}
					} else {
						return {
							success: false,
							status: 'conflict',
							roomEmail,
							roomName,
							message: `Room "${roomName}" (${roomEmail}) has a conflict during this time: ${avail.conflictMessage || 'Already booked'}.`
						};
					}
				}
			} catch (availErr: any) {
				console.warn(`[MicrosoftResourceProvider] Availability check warning for ${roomEmail}:`, availErr.message);
			}

			// 4. Heal missing mapping if an existing booking with our transactionId was matched
			if (matchedExternalId) {
				const patchUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(roomEmail)}/calendar/events/${encodeURIComponent(matchedExternalId)}`;
				await this.client.makeRequest<any>(patchUrl, {
					method: 'PATCH',
					body: JSON.stringify(buildPatchBody())
				});

				if (canTrackMapping) {
					await db.insert(syncMapping).values({
						syncConfigId: this.config!.id,
						eventId: eventId!,
						resourceId: resourceId!,
						externalId: matchedExternalId,
						providerId: 'microsoft-resources',
						metadata: mappingMetadata
					});
				}

				return {
					success: true,
					bookingId: matchedExternalId,
					status: 'confirmed',
					roomEmail,
					roomName,
					message: `Successfully updated room booking "${roomName}" (${roomEmail}) on Microsoft 365 (Booking ID: ${matchedExternalId}).`
				};
			}

			// 5. Create new booking on room calendar
			const bookUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(roomEmail)}/calendar/events`;
			const response = await this.client.makeRequest<any>(bookUrl, {
				method: 'POST',
				body: JSON.stringify(baseBody)
			});

			if (canTrackMapping && response?.id) {
				await db.insert(syncMapping).values({
					syncConfigId: this.config!.id,
					eventId: eventId!,
					resourceId: resourceId!,
					externalId: response.id,
					providerId: 'microsoft-resources',
					metadata: mappingMetadata
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
			await this.deleteRoomCalendarEvent(roomEmailOrEventId, bookingIdOrResourceId);
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
				await this.deleteRoomCalendarEvent(roomEmail, externalId);
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
