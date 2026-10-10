import { form, getRequestEvent } from '$app/server';
import { error } from "@sveltejs/kit";
import { db } from '@ac/db';
import { event, eventResource, eventContact, eventContactRole, eventLocation, tag, eventTag, eventMenu, recurringSeries, campaign, syncConfig } from '@ac/db';
import { eq, and, or, sql, inArray } from '@ac/db';
import { listEvents } from '../list.remote';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { createEventSchema } from '#lib/validations/events.js';
import { generateEventAssets } from '#lib/server/events/assets.js';
import { publishEventChange } from '#lib/server/realtime.js';
import { syncService } from '#lib/server/sync/service.js';
import { parseDateTime, toZoned } from '@internationalized/date';
import { createDefaultCampaignContent, type CampaignContent } from '@ac/validations';
import { invalidateEvent } from '#lib/server/cache/index.js';
import * as m from '#lib/paraglide/messages.js';

export const createEvent = form(createEventSchema, async (data) => {
	console.log('--- createEvent START ---');
	console.log('Raw Data:', JSON.stringify(data, null, 2));
	try {
		console.log('Authenticating user...');
		const user = getAuthenticatedUser();
		ensureAccess(user, 'events');
		console.log('User authenticated:', user.id);

		// Handle reminders
		const reminders = data.reminders;

		// Convert and type-safety check start/end dates
		if (!data.startDate) {
			console.error('Missing start date');
			error(400, 'Start date is required');
		}

		let start: Date;
		const startTimeZone = data.startTimeZone || 'UTC';

		try {
			if (data.startTime) {
				// Timed event (has time and timezone)
				const dString = `${data.startDate}T${data.startTime}`;
				const calendarDate = parseDateTime(dString);
				const zonedDate = toZoned(calendarDate, startTimeZone);
				start = zonedDate.toDate();
			} else {
				// All-day event (only date, no time)
				const dString = `${data.startDate}T00:00:00`;
				const calendarDate = parseDateTime(dString);
				const zonedDate = toZoned(calendarDate, startTimeZone);
				start = zonedDate.toDate();
			}
			console.log('Parsed Start Date:', start);
		} catch (e: any) {
			console.error('Invalid start date/time', data.startDate, data.startTime, e);
			error(400, `Invalid start date/time format: ${e.message}`);
		}

		// End date
		let end: Date;
		if (!data.endDate) {
			console.error('Missing end date');
			error(400, 'End date is required');
		}

		const endTimeZone = data.endTimeZone || startTimeZone;
		try {
			if (data.endTime) {
				const dString = `${data.endDate}T${data.endTime}`;
				const calendarDate = parseDateTime(dString);
				const zonedDate = toZoned(calendarDate, endTimeZone);
				end = zonedDate.toDate();
			} else {
				// Use 23:59:59 for end time if not provided (e.g., all day event)
				const dString = `${data.endDate}T23:59:59`;
				const calendarDate = parseDateTime(dString);
				const zonedDate = toZoned(calendarDate, endTimeZone);
				end = zonedDate.toDate();
			}
			console.log('Parsed End Date:', end);
		} catch (e: any) {
			console.error(`Invalid end date/time provided: ${e.message}`);
			error(400, `Invalid end date/time format: ${e.message}`);
		}

		// Handle Recurrence
		let recurrenceRule: string | null = null;
		if (data.recurrence) {
			if (Array.isArray(data.recurrence) && data.recurrence.length > 0) {
				recurrenceRule = data.recurrence[0];
			} else if (typeof data.recurrence === 'string') {
				recurrenceRule = data.recurrence;
			}
		}

		// Handle Tags
		let tagNames: string[] = [];
		if (data.tags) {
			tagNames = data.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
		}
		if (recurrenceRule && !tagNames.includes('Series')) {
			tagNames.push('Series');
		}
		// Deduplicate tags
		tagNames = [...new Set(tagNames)];

		const eventId = crypto.randomUUID();
		console.log('Generated Event ID:', eventId);

        // Handle SyncIds & Campaign
        let syncIds: string[] = [];
        if (data.syncIds) {
            syncIds = typeof data.syncIds === 'string' ? JSON.parse(data.syncIds) : data.syncIds;
        }

        // Auto-include default shared sync targets if syncIds was not explicitly provided
        if (data.syncIds === undefined || data.syncIds === null) {
            const defaultConfigs = await db
                .select({ id: syncConfig.id })
                .from(syncConfig)
                .where(
                    and(
                        eq(syncConfig.enabled, true),
                        sql`(${syncConfig.settings}->>'isDefault' = 'true')`
                    )
                );
            syncIds = defaultConfigs.map(c => c.id);
        }

        if (recurrenceRule && syncIds.length > 0) {
            const berlinConfigs = await db
                .select({ id: syncConfig.id, providerType: syncConfig.providerType })
                .from(syncConfig)
                .where(
                    and(
                        inArray(syncConfig.id, syncIds),
                        or(
                            eq(syncConfig.providerType, 'berlin-de-mh-calendar'),
                            eq(syncConfig.providerType, 'berlin-de-main-calendar')
                        )
                    )
                );
            if (berlinConfigs.length > 0) {
                const hasMain = berlinConfigs.some(c => c.providerType === 'berlin-de-main-calendar');
                const hasMh = berlinConfigs.some(c => c.providerType === 'berlin-de-mh-calendar');
                const errorMsg = (hasMain && hasMh)
                    ? m.berlin_de_series_sync_not_allowed()
                    : hasMain
                        ? m.berlin_de_main_series_sync_not_allowed()
                        : m.berlin_de_mh_series_sync_not_allowed();
                return {
                    success: false,
                    error: errorMsg
                };
            }
        }

        const initialCampaignContent: CampaignContent = createDefaultCampaignContent(syncIds);
        initialCampaignContent.items[eventId] = { entityType: 'event', syncs: {} };

        // Create Campaign for the event
        const [newCampaign] = await db.insert(campaign).values({
            userId: user.id,
            name: `Campaign for ${data.summary}`,
            content: initialCampaignContent
        } as any).returning();

		// Insert Master Event
		console.log('Inserting event into DB...');
		const participantsCount = data.participantsCount !== undefined ? Number(data.participantsCount) || 0 : 0;
		const [newEvent] = await db.insert(event).values({
			id: eventId,
			userId: user.id,
            campaignId: newCampaign?.id,
			summary: data.summary,
			description: data.description || null,
			internalNotes: data.internalNotes || null,
			categoryBerlinDotDe: data.categoryBerlinDotDe || null,
			ticketPriceUnknown: data.ticketPriceUnknown === 'true' || data.ticketPriceUnknown === true || data.ticketPriceUnknown === 'on',
			ticketPrice: (data.ticketPriceUnknown === 'true' || data.ticketPriceUnknown === true || data.ticketPriceUnknown === 'on') ? "0" : (data.ticketPrice || null),
			isAllDay: data.isAllDay === 'true' || data.isAllDay === true || data.isAllDay === 'on',
			status: data.status || 'confirmed',
			startDateTime: start,
			startTimeZone: data.startTimeZone || null,
			endDateTime: end,
			endTimeZone: data.endTimeZone || null,
			seriesId: null,
			recurringEventId: null,
			isException: false,
			recurrence: recurrenceRule ? [recurrenceRule] : null,
			exdates: [],
			attendees: (data.attendees as any) || null,
			participantsCount,
			reminders: reminders as any,
			isPublic: data.isPublic === 'true' || data.isPublic === true || data.isPublic === 'on',
			heroImage: data.heroImage || null,
			guestsCanInviteOthers: data.guestsCanInviteOthers === 'true' || data.guestsCanInviteOthers === true || data.guestsCanInviteOthers === 'on',
			guestsCanModify: data.guestsCanModify === 'true' || data.guestsCanModify === true || data.guestsCanModify === 'on',
			guestsCanSeeOtherGuests: data.guestsCanSeeOtherGuests === 'true' || data.guestsCanSeeOtherGuests === true || data.guestsCanSeeOtherGuests === 'on',
		} as any).returning();

		if (!newEvent) {
			console.error('No event returned from insert stub');
			error(500, 'Failed to create event');
		}

		// Helper to link associations
		const linkAssociations = async (targetEventId: string) => {
			// Locations
			const locationIds = typeof data.locationIds === 'string' ? JSON.parse(data.locationIds) : data.locationIds;
			if (locationIds && Array.isArray(locationIds) && locationIds.length > 0) {
				const associations = (locationIds as string[]).map((locationId: string) => ({
					eventId: targetEventId,
					locationId,
				}));
				await db.insert(eventLocation).values(associations);
			}

			// Resources
			const resourceIds = typeof data.resourceIds === 'string' ? JSON.parse(data.resourceIds) : data.resourceIds;
			if (resourceIds && Array.isArray(resourceIds) && resourceIds.length > 0) {
				const associations = (resourceIds as string[]).map((resourceId: string) => ({
					eventId: targetEventId,
					resourceId,
				}));
				await db.insert(eventResource).values(associations);
			}

			// Contacts
			const contactIds = typeof data.contactIds === 'string' ? JSON.parse(data.contactIds) : data.contactIds;
			if (contactIds && Array.isArray(contactIds) && contactIds.length > 0) {
				const associations = (contactIds as string[]).map((contactId: string) => ({
					eventId: targetEventId,
					contactId,
				}));
				await db.insert(eventContact).values(associations);
			}

			// Contact Roles
			if (data.contactRolesJson) {
				try {
					const rolesMap: Record<string, string[]> = JSON.parse(data.contactRolesJson);
					const roleEntries: { eventId: string; contactId: string; roleId: string }[] = [];
					for (const [cId, roleIds] of Object.entries(rolesMap)) {
						if (Array.isArray(roleIds)) {
							for (const rId of roleIds) {
								roleEntries.push({ eventId: targetEventId, contactId: cId, roleId: rId });
							}
						}
					}
					if (roleEntries.length > 0) {
						await db.insert(eventContactRole).values(roleEntries);
					}
				} catch (err) {
					console.error('Failed to parse or insert contact roles:', err);
				}
			}

			// Tags
			if (tagNames.length > 0) {
				for (const name of tagNames) {
					let [existingTag] = await db.select().from(tag).where(eq(tag.name, name));
					if (!existingTag) {
						[existingTag] = await db.insert(tag).values({ name, userId: user.id }).returning();
					}
					if (existingTag) {
						await db.insert(eventTag).values({ eventId: targetEventId, tagId: existingTag.id }).onConflictDoNothing();
					}
				}
			}

			// Menus
			let menuIds = [];
			if (typeof data.menuIds === 'string') {
				try { menuIds = JSON.parse(data.menuIds); } catch { menuIds = []; }
			} else if (Array.isArray(data.menuIds)) {
				menuIds = data.menuIds;
			}
			if (menuIds.length > 0) {
				const associations = (menuIds as string[]).map((menuId: string) => ({
					eventId: targetEventId,
					menuId,
				}));
				await db.insert(eventMenu).values(associations);
			}
		};

		// Link associations for master event
		await linkAssociations(newEvent.id);

		// Determine origin for asset generation
		let origin: string | undefined;
		try {
			const { getRequestEvent } = await import('$app/server');
			origin = getRequestEvent()?.url.origin;
		} catch (e) { /* ignore */ }

		console.log('Generating assets for master event via create.remote...');
		await generateEventAssets(newEvent.id, origin);

		console.log('Event created successfully, triggering sync and refreshing list...');

		await publishEventChange('create', [newEvent.id]);

		try {
			await syncService.syncItems(user.id, [newEvent.id], 'event');
		} catch (err) {
			console.error('[Create Remote] Sync error:', err);
		}

		await invalidateEvent([newEvent.id]);
		await listEvents().refresh();
		console.log('--- createEvent DONE ---');
		return { success: true };
	} catch (err: any) {
		console.error('--- createEvent ERROR ---', err);
		if (err?.status && err?.location) {
			error(500, err.message);
		}
		return {
			success: false,
			error: err?.message || 'An unexpected error occurred'
		};
	}
});
