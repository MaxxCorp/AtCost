import { query } from '$app/server';
import { db } from '@ac/db';
import { event, locationContact, inArray, eq, asc } from '@ac/db';
import { getOptionalUser, hasAccess } from '$lib/server/authorization';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { type Event } from '@ac/validations';
import { getEventRooms } from '$lib/utils/format-rooms';
import { resolveEventContactSync, isEmployeeContact } from '$lib/server/contact-resolution';

/**
 * Query: Read an event by ID
 * 
 * Access rules:
 * - If event is public: anyone can view (but only public-safe fields)
 * - If event is private: only authenticated users with 'events' access can view
 */
export const readEvent = query(v.string(), async (eventId: string): Promise<Event | null> => {
	// 1. Fetch event with relations using Drizzle Relational Queries
	const result = await db.query.event.findFirst({
		where: eq(event.id, eventId),
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

	if (!result) {
		return null;
	}

	// 2. Check Access
	const user = getOptionalUser();
	const isAuthorized = user && hasAccess(user, 'events');

	if (!result.isPublic) {
		if (!user) {
			error(403, 'Authentication required to view this event');
		}
		if (!isAuthorized) {
			error(403, 'You do not have permission to view this event');
		}
	}

	// 3. Resolve Primary Contact
	const hasEventEmployee = (result.contacts || []).some((ec: any) => isEmployeeContact(ec.contact || ec));
	const locationContactsMap = new Map<string, any[]>();

	if (!hasEventEmployee) {
		const neededLocationIds = new Set<string>();
		for (const l of result.locations || []) {
			if (l.location?.id) neededLocationIds.add(l.location.id);
			else if (l.locationId) neededLocationIds.add(l.locationId);
		}
		for (const r of result.resources || []) {
			const locId = (r.resource as any)?.locationId;
			if (locId) neededLocationIds.add(locId);
		}

		if (neededLocationIds.size > 0) {
			const locContactsData = await db.query.locationContact.findMany({
				where: inArray(locationContact.locationId, Array.from(neededLocationIds)),
				with: {
					contact: {
						with: {
							emails: true,
							phones: true,
							tags: { with: { tag: true } }
						}
					}
				}
			});
			for (const lc of locContactsData) {
				const list = locationContactsMap.get(lc.locationId) || [];
				list.push(lc);
				locationContactsMap.set(lc.locationId, list);
			}
		}
	}

	const evtLocations = (result.locations?.map((l: any) => l.location).filter(Boolean) || []).map((loc: any) => ({
		...loc,
		locationContacts: locationContactsMap.get(loc.id) || []
	}));

	const evtResources = (result.resources?.map((r: any) => r.resource).filter(Boolean) || []).map((res: any) => {
		if (res.locationId && locationContactsMap.has(res.locationId)) {
			return {
				...res,
				location: {
					id: res.locationId,
					locationContacts: locationContactsMap.get(res.locationId) || []
				}
			};
		}
		return res;
	});

	const resolvedContact = resolveEventContactSync({
		...result,
		locations: evtLocations,
		resources: evtResources
	}, {
		filterWorkOnly: !isAuthorized,
		fallbackToLocation: true,
		fallbackToFirst: true
	});

	// 3.5. Fetch instances if this is a series master
	let instances: any[] = [];
	if (!result.recurringEventId && result.seriesId) {
		const fetchedInstances = await db.query.event.findMany({
			where: eq(event.recurringEventId, result.id),
			orderBy: [asc(event.startDateTime)],
		});
		instances = fetchedInstances.map((inst: any) => ({
			id: inst.id,
			summary: inst.summary,
			startDateTime: inst.startDateTime?.toISOString() ?? null,
			endDateTime: inst.endDateTime?.toISOString() ?? null,
			status: inst.status,
		}));
	}

	const publicLocations = result.locations.filter(l => l.location.isPublic).map(l => l.location);
	const publicResources = result.resources.filter(r => r.resource).map(r => r.resource);

	// 4. Return Data
	if (!isAuthorized) {
		// Public safe object
		return {
			id: result.id,
			summary: result.summary,
			description: result.description,
			status: result.status,
			startDateTime: result.startDateTime?.toISOString() ?? null,
			endDateTime: result.endDateTime?.toISOString() ?? null,
			isAllDay: result.isAllDay,
			isPublic: result.isPublic,
			heroImage: result.heroImage,
			ticketPrice: result.ticketPrice,
			ticketPriceUnknown: result.ticketPriceUnknown,
			categoryBerlinDotDe: result.categoryBerlinDotDe,
			participantsCount: result.participantsCount ?? 0,
			createdAt: result.createdAt.toISOString(),
			updatedAt: result.updatedAt.toISOString(),
			locations: publicLocations,
			resources: publicResources,
			rooms: getEventRooms({ locations: publicLocations, resources: publicResources }),
			locationIds: publicLocations.map(l => l.id),
			resourceIds: publicResources.map(r => r.id),
			tags: result.tags.map(t => ({ id: t.tag.id, name: t.tag.name })),
			resolvedContact,
			contactIds: [],
			syncIds: [],
			instances: instances.length > 0 ? instances : undefined,
		} as any;
	}

	const allLocations = result.locations.map(l => l.location);
	const allResources = result.resources.map(r => r.resource).filter(Boolean);

	// Full object
	return {
		...result,
		iCalPath: result.iCalPath?.includes('/api/') ? result.iCalPath : `/api/events/${result.id}/event.ics`,
		qrCodePath: result.qrCodePath?.includes('/api/') ? result.qrCodePath : `/api/events/${result.id}/qr.png`,
		createdAt: result.createdAt.toISOString(),
		updatedAt: result.updatedAt.toISOString(),
		startDateTime: result.startDateTime?.toISOString() ?? null,
		endDateTime: result.endDateTime?.toISOString() ?? null,
		locations: allLocations,
		resources: allResources,
		rooms: getEventRooms({ locations: allLocations, resources: allResources }),
		resourceIds: result.resources.map(r => r.resourceId),
		contactIds: result.contacts.map(c => c.contactId),
		locationIds: result.locations.map(l => l.locationId),
		tags: result.tags.map(t => ({ id: t.tag.id, name: t.tag.name })),
		syncIds: (result.campaign?.content as any)?.syncIds || [],
		resolvedContact,
		instances: instances.length > 0 ? instances : undefined,
	} as any;
});
