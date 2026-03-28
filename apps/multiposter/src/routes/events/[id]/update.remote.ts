import { form } from '$app/server';
import { db } from '$lib/server/db';
import { event, eventResource, eventContact, eventLocation, tag, eventTag, recurringSeries, campaign } from '@ac/db';
import { eq, and, or, ne } from 'drizzle-orm';
import { listEvents } from '../list.remote';
import { readEvent } from './read.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { updateEventSchema } from '$lib/validations/events';
import { error } from '@sveltejs/kit';
import { generateEventAssets } from '$lib/server/events/assets';
import { publishEventChange } from '$lib/server/realtime';
import { syncService } from '$lib/server/sync/service';
import { parseDateTime, toZoned } from '@internationalized/date';

// Complete rewrite to support recurrence and use helper
export const updateExistingEvent = form(updateEventSchema, async (data) => {
	console.log('--- updateExistingEvent START ---');
	console.log('Raw Data:', JSON.stringify(data, null, 2));
	try {
		console.log('Authenticating user...');
		const user = getAuthenticatedUser();
		ensureAccess(user, 'events');
		console.log('User authenticated:', user.id);

		// Handle serialized reminders if provided
		let reminders = data.reminders;
		if (data.remindersJson) {
			console.log('Parsing remindersJson...');
			try {
				reminders = JSON.parse(data.remindersJson);
				console.log('Parsed reminders:', JSON.stringify(reminders));
			} catch (e) {
				console.error('Failed to parse remindersJson', e);
			}
		}

		// Prepare update object
		const updateData: any = {
			updatedAt: new Date(),
		};

		if (data.summary !== undefined) updateData.summary = data.summary;
		if (data.description !== undefined) updateData.description = data.description;
		if (data.location !== undefined) updateData.location = data.location;
		if (data.status !== undefined) updateData.status = data.status;
		if (data.categoryBerlinDotDe !== undefined) updateData.categoryBerlinDotDe = data.categoryBerlinDotDe;
		if (data.ticketPrice !== undefined) updateData.ticketPrice = data.ticketPrice;

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
				updateData.endDateTime = null;
			} else {
				try {
					if (data.endTime) {
						const dString = `${data.endDate}T${data.endTime}`;
						const calendarDate = parseDateTime(dString);
						const zonedDate = toZoned(calendarDate, endTimeZone);
						updateData.endDateTime = zonedDate.toDate();
					} else {
						const dString = `${data.endDate}T00:00:00`;
						const calendarDate = parseDateTime(dString);
						const zonedDate = toZoned(calendarDate, endTimeZone);
						updateData.endDateTime = zonedDate.toDate();
					}
					console.log('Parsed End Date:', updateData.endDateTime);
				} catch (e: any) {
					console.warn(`Invalid end date/time provided, setting to null: ${e.message}`);
					updateData.endDateTime = null;
				}
			}
		}

		if (data.isAllDay !== undefined) updateData.isAllDay = data.isAllDay === 'true' || data.isAllDay === true;

		if (data.recurrence !== undefined) {
			// If empty string, treat as null (clearing recurrence)
			updateData.recurrence = data.recurrence ? [data.recurrence] : null;

			// If we are setting recurrence, this event becomes a Master (or is already).
			// ensure it doesn't point to another event as parent
			updateData.recurringEventId = null;
		}

		if (data.attendees !== undefined) updateData.attendees = data.attendees || null;
		if (reminders !== undefined) updateData.reminders = reminders || null;

		if (data.isPublic !== undefined) updateData.isPublic = data.isPublic === 'true';
		if (data.guestsCanInviteOthers !== undefined) updateData.guestsCanInviteOthers = data.guestsCanInviteOthers === 'true';
		if (data.guestsCanModify !== undefined) updateData.guestsCanModify = data.guestsCanModify === 'true';
		if (data.guestsCanSeeOtherGuests !== undefined) updateData.guestsCanSeeOtherGuests = data.guestsCanSeeOtherGuests === 'true';
		if (data.heroImage !== undefined) updateData.heroImage = data.heroImage || null;

		console.log('Update payload:', JSON.stringify(updateData, null, 2));

		const updatedEvent = await db.transaction(async (tx) => {
			const [updatedEvent] = await tx
				.update(event)
				.set(updateData)
				.where(eq(event.id, data.id))
				.returning();

			if (!updatedEvent) {
				error(404, 'Event not found');
			}

			// Handle SyncIds & Campaign update
			console.log(`[Update Remote] Received syncIds:`, data.syncIds);
			if (data.syncIds !== undefined) {
				const syncIds = typeof data.syncIds === 'string' ? JSON.parse(data.syncIds) : data.syncIds;
				console.log(`[Update Remote] Parsed syncIds:`, syncIds);
				if (updatedEvent.campaignId) {
					await tx.update(campaign).set({
						content: { syncIds },
						updatedAt: new Date()
					}).where(eq(campaign.id, updatedEvent.campaignId));
				} else {
					const [newCampaign] = await tx.insert(campaign).values({
						userId: user.id,
						name: `Campaign for ${updatedEvent.summary}`,
						content: { syncIds }
					}).returning();
					if (newCampaign) {
						await tx.update(event).set({ campaignId: newCampaign.id }).where(eq(event.id, updatedEvent.id));
						updatedEvent.campaignId = newCampaign.id;
					}
				}
			}

			// Prepare data for association updates
			const locationIds = data.locationIds ? (typeof data.locationIds === 'string' ? JSON.parse(data.locationIds) : data.locationIds) : undefined;
			const resourceIds = data.resourceIds ? (typeof data.resourceIds === 'string' ? JSON.parse(data.resourceIds) : data.resourceIds) : undefined;
			const contactIds = data.contactIds ? (typeof data.contactIds === 'string' ? JSON.parse(data.contactIds) : data.contactIds) : undefined;

			let tagNames: string[] | undefined = undefined;
			if (data.tags !== undefined) {
				tagNames = data.tags ? data.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0) : [];
				// Add Series tag if recurring
				if (updatedEvent.seriesId || (updatedEvent.recurrence && (updatedEvent.recurrence as string[]).length > 0) || updatedEvent.recurringEventId) {
					if (!tagNames.includes('Series')) {
						tagNames.push('Series');
					}
				}
			}

			const { updateEventAssociations } = await import('$lib/server/events/associations');

			// Update Associations for Master Event
			await updateEventAssociations({
				eventId: data.id,
				userId: user.id,
				locationIds,
				resourceIds,
				contactIds,
				tags: tagNames,
				tx
			});

			// Handle Recurrence Expansion/Update
			if (data.recurrence !== undefined) {
				console.log('Handling recurrence instances update...');

				// 1. Delete existing instances
				if (updatedEvent.seriesId) {
					await tx.delete(event).where(
						and(
							eq(event.seriesId, updatedEvent.seriesId),
							ne(event.id, data.id)
						)
					);
				}
				await tx.delete(event).where(eq(event.recurringEventId, data.id));

				// 2. Handle series record
				let seriesId = updatedEvent.seriesId;
				let newRecurrenceRule: string | null = null;
				if (data.recurrence) {
					newRecurrenceRule = Array.isArray(data.recurrence) ? data.recurrence[0] : data.recurrence;
				}

				if (newRecurrenceRule) {
					const start = updatedEvent.startDateTime ? new Date(updatedEvent.startDateTime) : new Date();
					const end = updatedEvent.endDateTime ? new Date(updatedEvent.endDateTime) : null;

					if (seriesId) {
						await tx.update(recurringSeries)
							.set({
								rrule: newRecurrenceRule,
								anchorDate: start,
								anchorEndDate: end,
								updatedAt: new Date(),
							})
							.where(eq(recurringSeries.id, seriesId));
					} else {
						const [newSeries] = await tx.insert(recurringSeries).values({
							rrule: newRecurrenceRule,
							anchorDate: start,
							anchorEndDate: end,
							userId: user.id,
						}).returning();
						if (newSeries) {
							seriesId = newSeries.id;
							await tx.update(event)
								.set({ seriesId })
								.where(eq(event.id, data.id));
							updatedEvent.seriesId = seriesId;
						}
					}

					// 3. Expand and create new instances
					const { expandRecurrence } = await import('$lib/server/events/recurrence');

					let start2: Date = updatedEvent.startDateTime ? new Date(updatedEvent.startDateTime) : new Date();
					let end2: Date | null = updatedEvent.endDateTime ? new Date(updatedEvent.endDateTime) : null;

					const instances = expandRecurrence(newRecurrenceRule, start2, end2);

					for (const { date, end: instanceEnd } of instances) {
						const instanceId = crypto.randomUUID();

						await tx.insert(event).values({
							id: instanceId,
							userId: user.id,
							campaignId: updatedEvent.campaignId,
							summary: updatedEvent.summary,
							description: updatedEvent.description,
							location: updatedEvent.location,
							categoryBerlinDotDe: updatedEvent.categoryBerlinDotDe,
							ticketPrice: updatedEvent.ticketPrice,
							isAllDay: updatedEvent.isAllDay,
							status: updatedEvent.status,
							startDateTime: date,
							startTimeZone: updatedEvent.startTimeZone,
							endDateTime: updatedEvent.endDateTime && instanceEnd ? instanceEnd : null,
							endTimeZone: updatedEvent.endTimeZone,
							seriesId: seriesId,
							isException: false,
							recurrence: updatedEvent.recurrence,
							recurringEventId: updatedEvent.id,
							originalStartTime: { dateTime: date.toISOString() },
							attendees: updatedEvent.attendees,
							reminders: updatedEvent.reminders,
							isPublic: updatedEvent.isPublic,
							guestsCanInviteOthers: updatedEvent.guestsCanInviteOthers,
							guestsCanModify: updatedEvent.guestsCanModify,
							guestsCanSeeOtherGuests: updatedEvent.guestsCanSeeOtherGuests,
						});

						await updateEventAssociations({
							eventId: instanceId,
							userId: user.id,
							locationIds,
							resourceIds,
							contactIds,
							tags: tagNames,
							tx
						});
					}
				} else {
					if (seriesId) {
						await tx.delete(recurringSeries).where(eq(recurringSeries.id, seriesId));
						await tx.update(event)
							.set({ seriesId: null })
							.where(eq(event.id, data.id));
						updatedEvent.seriesId = null;
					}
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

		// Regenerate assets for all involved events (master + instances if updated)
		console.log('Regenerating assets after update...');
		await generateEventAssets(data.id, origin);

		if (data.recurrence !== undefined) {
			const instances = await db.query.event.findMany({
				where: (e, { eq, and, ne }) => and(
					eq(e.seriesId, updatedEvent.seriesId || '00000000-0000-0000-0000-000000000000'),
					ne(e.id, data.id)
				)
			});
			for (const inst of instances) {
				await generateEventAssets(inst.id, origin);
			}
		}


		console.log('Regenerating assets for master event via update.remote...');
		await generateEventAssets(data.id, origin);

		console.log('Event updated successfully, refreshing list...');

		if (updatedEvent) {
			await publishEventChange('update', [updatedEvent.id]);
			// Trigger background sync to external providers
			await syncService.triggerPushSync(user.id, updatedEvent.id, 'event');

		}

		await listEvents().refresh();
		console.log('--- updateExistingEvent DONE ---');
		return { success: true };
	} catch (err: any) {
		console.error('--- updateExistingEvent ERROR ---', err);
		if (err?.status && err?.location) {
			error(500, err.message);
		}
		return {
			success: false,
			error: err?.message || 'An unexpected error occurred'
		};
	}
});
