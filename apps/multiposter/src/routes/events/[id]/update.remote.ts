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
export const updateEvent = form(updateEventSchema, async (data) => {
	console.log('--- updateEvent START ---');
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

		// Prepare data for association updates
		const locationIds = data.locationIds ? (typeof data.locationIds === 'string' ? JSON.parse(data.locationIds) : data.locationIds) : undefined;
		const resourceIds = data.resourceIds ? (typeof data.resourceIds === 'string' ? JSON.parse(data.resourceIds) : data.resourceIds) : undefined;
		const contactIds = data.contactIds ? (typeof data.contactIds === 'string' ? JSON.parse(data.contactIds) : data.contactIds) : undefined;

		let tagNames: string[] | undefined = undefined;
		if (data.tags !== undefined) {
			tagNames = data.tags ? data.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0) : [];
		}

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

			// Update Associations for Master Event
			await linkAssociations(data.id, tx);

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

						await linkAssociations(instanceId, tx);
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

		console.log('Event updated successfully, refreshing list...');

		if (updatedEvent) {
			let allAffectedIds = [updatedEvent.id];
			if (data.recurrence !== undefined && updatedEvent.seriesId) {
				const instances = await db.query.event.findMany({
					where: (e, { eq, and, ne }) => and(
						eq(e.seriesId, updatedEvent.seriesId || '00000000-0000-0000-0000-000000000000'),
						ne(e.id, data.id)
					),
					columns: { id: true }
				});
				allAffectedIds = [updatedEvent.id, ...instances.map(i => i.id)];
			}

			await publishEventChange('update', allAffectedIds);
			// Trigger background sync to external providers for all affected instances
			await syncService.syncItems(user.id, allAffectedIds, 'event');
		}

		// Refresh caches - Fetch the full state inlined for "easier reasoning" and avoiding partial state wiping
		const fullEventData = await db.query.event.findFirst({
			where: eq(event.id, data.id),
			with: {
				locations: { with: { location: true } },
				contacts: {
					with: {
						contact: {
							with: {
								emails: true,
								phones: true,
								tags: { with: { tag: true } }
							}
						}
					}
				},
				resources: { with: { resource: true } },
				tags: { with: { tag: true } },
				campaign: true,
			},
		});

		if (fullEventData) {
			// Compute resolved contact (duplicated from read.remote for self-containment)
			const c = fullEventData.contacts.find(ec => ec.contact.tags.some((ct: any) => ct.tag.name === 'Employee'))?.contact || fullEventData.contacts[0]?.contact;
			let resolvedContact = null;
			if (c) {
				resolvedContact = {
					name: c.displayName || `${c.givenName || ''} ${c.familyName || ''}`.trim(),
					email: c.emails.find((e: any) => e.primary)?.value || c.emails[0]?.value || '',
					phone: c.phones.find((p: any) => p.primary)?.value || c.phones[0]?.value || '',
					qrCodeDataUrl: c.qrCodePath || undefined
				};
			}

			const transformed = {
				...fullEventData,
				createdAt: fullEventData.createdAt.toISOString(),
				updatedAt: fullEventData.updatedAt.toISOString(),
				startDateTime: fullEventData.startDateTime?.toISOString() ?? null,
				endDateTime: fullEventData.endDateTime?.toISOString() ?? null,
				resourceIds: fullEventData.resources.map(r => r.resourceId),
				contactIds: fullEventData.contacts.map(c => c.contactId),
				locationIds: fullEventData.locations.map(l => l.locationId),
				tags: fullEventData.tags.map(t => ({ id: t.tag.id, name: t.tag.name })),
				syncIds: (fullEventData.campaign?.content as any)?.syncIds || [],
				resolvedContact,
			};
			await (readEvent(data.id) as any).set(transformed);
		} else {
			await (readEvent(data.id) as any).refresh();
		}

		void listEvents().refresh();
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
