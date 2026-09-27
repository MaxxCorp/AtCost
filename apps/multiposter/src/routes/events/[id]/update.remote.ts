import { form, getRequestEvent } from '$app/server';
import { db } from '@ac/db';
import { event, eventResource, eventContact, eventLocation, tag, eventTag, recurringSeries, campaign } from '@ac/db';
import { eq, and, or, ne, inArray, sql } from '@ac/db';
import { listEvents } from '../list.remote';
import { readEvent } from './read.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { updateEventSchema } from '$lib/validations/events';
import { error } from '@sveltejs/kit';
import { generateEventAssets } from '$lib/server/events/assets';
import { publishEventChange } from '$lib/server/realtime';
import { syncService } from '$lib/server/sync/service';
import { parseDateTime, toZoned } from '@internationalized/date';
import { createDefaultCampaignContent, type CampaignContent } from '@ac/validations';
import { invalidateEvent } from '$lib/server/cache';

// Complete rewrite to support recurrence and use helper
export const updateEvent = form(updateEventSchema, async (data) => {
	console.log('--- updateEvent START ---');
	console.log('Raw Data:', JSON.stringify(data, null, 2));
	try {
		console.log('Authenticating user...');
		const user = getAuthenticatedUser();
		ensureAccess(user, 'events');
		console.log('User authenticated:', user.id);

		const isVirtualInstance = data.id.includes('_inst_');
		const [instMasterId, instIso] = isVirtualInstance ? data.id.split('_inst_') : [null, null];

		let [oldEvent] = await db.select().from(event).where(eq(event.id, data.id));
		if (!oldEvent && isVirtualInstance && instMasterId) {
			const [masterEvent] = await db.select().from(event).where(eq(event.id, instMasterId));
			if (!masterEvent) {
				error(404, 'Event not found');
			}
			oldEvent = masterEvent;
		} else if (!oldEvent) {
			error(404, 'Event not found');
		}

		// Handle reminders
		const reminders = data.reminders;

		// Prepare update object
		const updateData: any = {
			updatedAt: new Date(),
			userId: user.id,
		};

		if (data.summary !== undefined) updateData.summary = data.summary;
		if (data.description !== undefined) updateData.description = data.description;
		if (data.internalNotes !== undefined) updateData.internalNotes = data.internalNotes;
		if (data.status !== undefined) updateData.status = data.status;
		if (data.categoryBerlinDotDe !== undefined) updateData.categoryBerlinDotDe = data.categoryBerlinDotDe;
		updateData.ticketPriceUnknown = data.ticketPriceUnknown === 'true' || data.ticketPriceUnknown === true || data.ticketPriceUnknown === 'on';
		if (data.ticketPrice !== undefined) {
			updateData.ticketPrice = updateData.ticketPriceUnknown ? "0" : data.ticketPrice;
		}

		if (data.startDate !== undefined) {
			const startTimeZone = data.startTimeZone || 'UTC';
			updateData.startTimeZone = data.startTimeZone || null;
			try {
				if (data.startTime) {
					// Timed event (has time and timezone)
					const dString = `${data.startDate}T${data.startTime}`;
					const calendarDate = parseDateTime(dString);
					const zonedDate = toZoned(calendarDate, startTimeZone);
					updateData.startDateTime = zonedDate.toDate();
				} else if (data.startDate) {
					// All-day event (only date, no time)
					const dString = `${data.startDate}T00:00:00`;
					const calendarDate = parseDateTime(dString);
					const zonedDate = toZoned(calendarDate, startTimeZone);
					updateData.startDateTime = zonedDate.toDate();
				}
				console.log('Parsed Start Date:', updateData.startDateTime);
			} catch (e: any) {
				console.error('Invalid start date/time', data.startDate, data.startTime, e);
			}
		}

		if (data.endDate !== undefined) {
			const endTimeZone = data.endTimeZone || data.startTimeZone || 'UTC';
			updateData.endTimeZone = data.endTimeZone || null;
			if (!data.endDate) {
				error(400, 'End date is required');
			} else {
				try {
					if (data.endTime) {
						const dString = `${data.endDate}T${data.endTime}`;
						const calendarDate = parseDateTime(dString);
						const zonedDate = toZoned(calendarDate, endTimeZone);
						updateData.endDateTime = zonedDate.toDate();
					} else {
						// Use 23:59:59 for end time if not provided (e.g., all day event)
						const dString = `${data.endDate}T23:59:59`;
						const calendarDate = parseDateTime(dString);
						const zonedDate = toZoned(calendarDate, endTimeZone);
						updateData.endDateTime = zonedDate.toDate();
					}
					console.log('Parsed End Date:', updateData.endDateTime);
				} catch (e: any) {
					console.error(`Invalid end date/time provided: ${e.message}`);
					error(400, `Invalid end date/time format: ${e.message}`);
				}
			}
		}

		updateData.isAllDay = data.isAllDay === 'true' || data.isAllDay === true || data.isAllDay === 'on';

		if (data.recurrence !== undefined) {
			updateData.recurrence = data.recurrence ? (Array.isArray(data.recurrence) ? data.recurrence : [data.recurrence]) : null;
			if (updateData.recurrence) {
				updateData.recurringEventId = null;
			}
		}

		if (data.attendees !== undefined) updateData.attendees = data.attendees || null;
		if (reminders !== undefined) updateData.reminders = reminders || null;

		updateData.isPublic = data.isPublic === 'true' || data.isPublic === true || data.isPublic === 'on';
		updateData.guestsCanInviteOthers = data.guestsCanInviteOthers === 'true' || data.guestsCanInviteOthers === true || data.guestsCanInviteOthers === 'on';
		updateData.guestsCanModify = data.guestsCanModify === 'true' || data.guestsCanModify === true || data.guestsCanModify === 'on';
		updateData.guestsCanSeeOtherGuests = data.guestsCanSeeOtherGuests === 'true' || data.guestsCanSeeOtherGuests === true || data.guestsCanSeeOtherGuests === 'on';
		if (data.heroImage !== undefined) updateData.heroImage = data.heroImage || null;
		if (data.participantsCount !== undefined) updateData.participantsCount = Number(data.participantsCount) || 0;

		console.log('Update payload:', JSON.stringify(updateData, null, 2));

		// Prepare data for association updates
		const locationIds = data.locationIds ? (typeof data.locationIds === 'string' ? JSON.parse(data.locationIds) : data.locationIds) : undefined;
		const resourceIds = data.resourceIds ? (typeof data.resourceIds === 'string' ? JSON.parse(data.resourceIds) : data.resourceIds) : undefined;
		const contactIds = data.contactIds ? (typeof data.contactIds === 'string' ? JSON.parse(data.contactIds) : data.contactIds) : undefined;

		let tagNames: string[] | undefined = undefined;
		if (data.tags !== undefined) {
			tagNames = data.tags ? data.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0) : [];
		}

		let oldInstanceIds: string[] = [];

		let effectiveTargetId = data.id;

		const updatedEvent = await db.transaction(async (tx) => {
			let targetId = data.id;
			let isNewException = false;

			if (isVirtualInstance && instMasterId && instIso) {
				if (data.seriesMode === 'series') {
					targetId = instMasterId;
				} else {
					const [existingException] = await tx.select().from(event).where(
						or(
							eq(event.id, data.id),
							and(
								eq(event.recurringEventId, instMasterId),
								sql`${event.originalStartTime}->>'dateTime' = ${instIso}`
							)
						)
					);

					if (existingException) {
						targetId = existingException.id;
					} else {
						const [master] = await tx.select().from(event).where(eq(event.id, instMasterId));
						if (!master) {
							error(404, 'Master event not found');
						}

						const { id: _, createdAt: _c, updatedAt: _u, ...masterRest } = master;
						const [createdException] = await tx.insert(event).values({
							...masterRest,
							id: data.id,
							recurringEventId: instMasterId,
							originalStartTime: { dateTime: instIso },
							recurrence: null,
							seriesId: null,
							...updateData,
							userId: user.id
						}).returning();

						targetId = createdException.id;
						isNewException = true;
					}
				}
			}

			effectiveTargetId = targetId;

			let updatedEvent: any;
			if (isNewException) {
				const [fetched] = await tx.select().from(event).where(eq(event.id, targetId));
				updatedEvent = fetched;
			} else {
				const [updated] = await tx
					.update(event)
					.set(updateData)
					.where(eq(event.id, targetId))
					.returning();
				updatedEvent = updated;
			}

			if (!updatedEvent) {
				error(404, 'Event not found');
			}

			// Handle SyncIds & Campaign update
			console.log(`[Update Remote] Received syncIds:`, data.syncIds);
			if (data.syncIds !== undefined) {
				const syncIds = typeof data.syncIds === 'string' ? JSON.parse(data.syncIds) : data.syncIds;
				console.log(`[Update Remote] Parsed syncIds:`, syncIds);
				if (updatedEvent.campaignId) {
					const [camp] = await tx.select().from(campaign).where(eq(campaign.id, updatedEvent.campaignId));
					const content: CampaignContent = (camp?.content as any)?.version === 1
						? (camp?.content as any)
						: createDefaultCampaignContent(syncIds);

					// Update targets
					content.targets = {};
					for (const id of syncIds) {
						content.targets[id] = { enabled: true };
					}
					if (!content.items) content.items = {};
					if (!content.items[updatedEvent.id]) {
						content.items[updatedEvent.id] = { entityType: 'event', syncs: {} };
					}

					await tx.update(campaign).set({
						content,
						updatedAt: new Date()
					}).where(eq(campaign.id, updatedEvent.campaignId));
				} else {
					const newContent = createDefaultCampaignContent(syncIds);
					newContent.items[updatedEvent.id] = { entityType: 'event', syncs: {} };
					const [newCampaign] = await tx.insert(campaign).values({
						userId: user.id,
						name: `Campaign for ${updatedEvent.summary}`,
						content: newContent
					}).returning();
					if (newCampaign) {
						await tx.update(event).set({ campaignId: newCampaign.id }).where(eq(event.id, updatedEvent.id));
						updatedEvent.campaignId = newCampaign.id;
					}
				}

				// If master event, ensure existing recurring instances also have campaignId set
				if (updatedEvent.campaignId && !updatedEvent.recurringEventId) {
					const instanceCondition = or(
						eq(event.recurringEventId, updatedEvent.id),
						updatedEvent.seriesId ? and(eq(event.seriesId, updatedEvent.seriesId), ne(event.id, updatedEvent.id)) : undefined
					);
					await tx.update(event).set({ campaignId: updatedEvent.campaignId }).where(instanceCondition);
				}
			}

			// Add Series tag if recurring
			if (tagNames !== undefined) {
				if (updatedEvent.seriesId || (updatedEvent.recurrence && (updatedEvent.recurrence as string[]).length > 0) || updatedEvent.recurringEventId) {
					if (!tagNames.includes('Series')) {
						tagNames.push('Series');
					}
				}
			}

			// Internal helper to update associations
			const linkAssociations = async (targetEventId: string, client: any) => {
				// Locations
				if (locationIds !== undefined) {
					await client.delete(eventLocation).where(eq(eventLocation.eventId, targetEventId));
					if (locationIds.length > 0) {
						await client.insert(eventLocation).values(
							locationIds.map((id: string) => ({ eventId: targetEventId, locationId: id }))
						);
					}
				}

				// Resources
				if (resourceIds !== undefined) {
					await client.delete(eventResource).where(eq(eventResource.eventId, targetEventId));
					if (resourceIds.length > 0) {
						await client.insert(eventResource).values(
							resourceIds.map((id: string) => ({ eventId: targetEventId, resourceId: id }))
						);
					}
				}

				// Contacts
				if (contactIds !== undefined) {
					await client.delete(eventContact).where(eq(eventContact.eventId, targetEventId));
					if (contactIds.length > 0) {
						await client.insert(eventContact).values(
							contactIds.map((id: string) => ({ eventId: targetEventId, contactId: id }))
						);
					}
				}

				// Tags
				if (tagNames !== undefined) {
					const uniqueTags = [...new Set(tagNames)];
					await client.delete(eventTag).where(eq(eventTag.eventId, targetEventId));
					if (uniqueTags.length > 0) {
						for (const name of uniqueTags) {
							let [existingTag] = await client.select().from(tag).where(eq(tag.name, name));
							if (!existingTag) {
								[existingTag] = await client.insert(tag).values({ name, userId: user.id }).returning();
							}
							if (existingTag) {
								await client.insert(eventTag).values({ eventId: targetEventId, tagId: existingTag.id }).onConflictDoNothing();
							}
						}
					}
				}
			};

			// Update Associations for Target Event
			await linkAssociations(targetId, tx);

			// Clean up legacy series record if recurrence was explicitly cleared
			if (data.recurrence === null || (Array.isArray(data.recurrence) && data.recurrence.length === 0)) {
				if (updatedEvent.seriesId) {
					await tx.delete(recurringSeries).where(eq(recurringSeries.id, updatedEvent.seriesId));
					await tx.update(event).set({ seriesId: null }).where(eq(event.id, targetId));
					updatedEvent.seriesId = null;
				}
			}

			return updatedEvent;
		});

		// Determine origin for asset generation
		let origin: string | undefined;
		try {
			const { getRequestEvent } = await import('$app/server');
			origin = getRequestEvent()?.url.origin;
		} catch (e) { /* ignore */ }

		// Regenerate assets for the updated event
		console.log('Regenerating assets after update...');
		await generateEventAssets(effectiveTargetId, origin);

		console.log('Event updated successfully, refreshing list...');

		await publishEventChange('update', [effectiveTargetId], {
			id: user.id,
			name: user.name || user.email,
			email: user.email
		});

		try {
			await syncService.syncItems(user.id, [effectiveTargetId], 'event');
		} catch (err) {
			console.error('[Update Remote] Sync error:', err);
		}

		// Refresh caches
		const invalidateIds = [effectiveTargetId, data.id];
		if (instMasterId) invalidateIds.push(instMasterId);
		await invalidateEvent(invalidateIds);
		await readEvent(effectiveTargetId).refresh();
		if (data.id !== effectiveTargetId) {
			await readEvent(data.id).refresh();
		}
		await listEvents().refresh();
		console.log('--- updateEvent DONE ---');
		return { success: true };
	} catch (err: any) {
		console.error('--- updateEvent ERROR ---', err);
		if (err?.status && err?.location) {
			error(500, err.message);
		}
		return {
			success: false,
			error: err?.message || 'An unexpected error occurred'
		};
	}
});
