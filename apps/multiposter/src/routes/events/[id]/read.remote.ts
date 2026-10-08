import { query } from '$app/server';
import { db } from '@ac/db';
import { event, locationContact, inArray, eq, asc, or, and, sql } from '@ac/db';
import { getOptionalUser, hasAccess } from '#lib/server/authorization.js';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { type Event, getCampaignTargetIds } from '@ac/validations';
import { getEventRooms } from '#lib/utils/format-rooms.js';
import { resolveEventContactSync, isEmployeeContact } from '#lib/server/contact-resolution.js';
import { getCache, setCache, cacheKeys } from '#lib/server/cache/index.js';
import { getSeriesInstances } from '#lib/server/events/instances.js';

/**
 * Query: Read an event by ID
 * 
 * Access rules:
 * - If event is public: anyone can view (but only public-safe fields)
 * - If event is private: only authenticated users with 'events' access can view
 */
export const readEvent = query(v.string(), async (eventId: string): Promise<Event | null> => {
	const user = getOptionalUser();
	const isAuthorized = !!(user && hasAccess(user, 'events'));

	// 0. Cache check for public viewers / robots
	if (!isAuthorized) {
		const cachedPayload = await getCache<{ isPrivate: boolean; data?: Event | null }>(cacheKeys.publicEvent(eventId));
		if (cachedPayload !== null) {
			if (cachedPayload.isPrivate) {
				if (!user) {
					error(403, 'Authentication required to view this event');
				}
				error(403, 'You do not have permission to view this event');
			}
			return (cachedPayload.data as any) ?? null;
		}
	}

	const isVirtual = eventId.includes('_inst_');
	const instMasterId = isVirtual ? eventId.split('_inst_')[0] : null;
	const instIso = isVirtual ? eventId.split('_inst_')[1] : null;

	// 1. Fetch event with relations using Drizzle Relational Queries
	let result: any = null;

	if (isVirtual && instMasterId && instIso) {
		const decodedIso = decodeURIComponent(instIso);
		// Check if a saved exception already exists for this instance
		result = await db.query.event.findFirst({
			where: and(
				eq(event.recurringEventId, instMasterId),
				or(
					sql`${event.originalStartTime}->>'dateTime' = ${instIso}`,
					sql`${event.originalStartTime}->>'dateTime' = ${decodedIso}`
				)
			),
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
				menus: {
					with: {
						menu: {
							with: {
								items: {
									with: {
										consumable: true,
										recipe: true,
									}
								}
							}
						}
					}
				},
			},
		});

		// If no exception exists yet, synthesize the virtual instance from the master
		if (!result) {
			const master = await db.query.event.findFirst({
				where: eq(event.id, instMasterId),
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
					menus: {
						with: {
							menu: {
								with: {
									items: {
										with: {
											consumable: true,
											recipe: true,
										}
									}
								}
							}
						}
					},
				},
			});

			if (master) {
				const masterExdates = Array.isArray(master.exdates) ? (master.exdates as string[]) : [];
				const targetDate = new Date(decodedIso);
				if (!isNaN(targetDate.getTime())) {
					const isExcluded = masterExdates.some(ex => {
						const exTime = new Date(ex).getTime();
						return !isNaN(exTime) && Math.abs(exTime - targetDate.getTime()) < 60000;
					});

					if (!isExcluded) {
						const duration = (master.startDateTime && master.endDateTime)
							? (new Date(master.endDateTime).getTime() - new Date(master.startDateTime).getTime())
							: 3600000;
						result = {
							...master,
							id: eventId,
							recurringEventId: master.id,
							isException: false,
							recurrence: null,
							startDateTime: targetDate,
							endDateTime: new Date(targetDate.getTime() + duration),
						} as any;
					}
				}
			}
		}
	} else {
		// Non-virtual event ID. Ensure it matches UUID format before querying Postgres
		const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId);
		if (!isUuid) {
			if (!isAuthorized) {
				await setCache(cacheKeys.publicEvent(eventId), { isPrivate: false, data: null }, 30);
			}
			return null;
		}

		result = await db.query.event.findFirst({
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
				menus: {
					with: {
						menu: {
							with: {
								items: {
									with: {
										consumable: true,
										recipe: true,
									}
								}
							}
						}
					}
				},
			},
		});
	}

	if (!result) {
		if (!isAuthorized) {
			await setCache(cacheKeys.publicEvent(eventId), { isPrivate: false, data: null }, 30);
		}
		return null;
	}

	// 2. Check Access
	if (!result.isPublic) {
		if (!isAuthorized) {
			await setCache(cacheKeys.publicEvent(eventId), { isPrivate: true }, 300);
		}
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

	// 3.5. Fetch instances & series master info
	let instances: any[] = [];
	let seriesMaster: any = null;

	const masterId = result.recurringEventId || (!result.recurringEventId && (result.seriesId || (result.recurrence && (result.recurrence as string[]).length > 0)) ? result.id : null);

	if (masterId) {
		let masterRecord: any = null;
		if (result.recurringEventId) {
			masterRecord = await db.query.event.findFirst({
				where: eq(event.id, result.recurringEventId),
			});
			if (masterRecord) {
				seriesMaster = {
					id: masterRecord.id,
					summary: masterRecord.summary,
					startDateTime: masterRecord.startDateTime?.toISOString() ?? null,
					endDateTime: masterRecord.endDateTime?.toISOString() ?? null,
					recurrence: masterRecord.recurrence,
				};
			}
		} else {
			masterRecord = result;
			seriesMaster = {
				id: result.id,
				summary: result.summary,
				startDateTime: result.startDateTime?.toISOString() ?? null,
				endDateTime: result.endDateTime?.toISOString() ?? null,
				recurrence: result.recurrence,
			};
		}

		if (masterRecord) {
			instances = await getSeriesInstances(masterRecord);
		}
	}

	const publicLocations = result.locations.filter((l: any) => l.location.isPublic).map((l: any) => l.location);
	const publicResources = result.resources.filter((r: any) => r.resource).map((r: any) => r.resource);

	const toIsoSafe = (d: any) => {
		if (!d) return null;
		if (d instanceof Date) return d.toISOString();
		const parsed = new Date(d);
		return isNaN(parsed.getTime()) ? null : parsed.toISOString();
	};

	const eventMenus = (result.menus || []).map((em: any) => {
		const m = em.menu;
		if (!m) return null;
		let totalPricePerPortion = 0;
		let totalCostPerPortion = 0;
		const items = (m.items || []).map((it: any) => {
			const linePrice = (it.unitPrice || 0) * (it.portionAmount || 1);
			const lineCost = (it.costPrice || 0) * (it.portionAmount || 1);
			totalPricePerPortion += linePrice;
			totalCostPerPortion += lineCost;
			return {
				...it,
				createdAt: it.createdAt ? toIsoSafe(it.createdAt) : undefined,
				updatedAt: it.updatedAt ? toIsoSafe(it.updatedAt) : undefined,
			};
		});
		return {
			...m,
			createdAt: toIsoSafe(m.createdAt),
			updatedAt: toIsoSafe(m.updatedAt),
			items,
			totalPricePerPortion: Math.round(totalPricePerPortion * 100) / 100,
			totalCostPerPortion: Math.round(totalCostPerPortion * 100) / 100,
		};
	}).filter(Boolean);

	const iCalPath = result.id.includes('_inst_') ? `/api/events/${result.id}/event.ics` : (result.iCalPath?.includes('/api/') ? result.iCalPath : `/api/events/${result.id}/event.ics`);
	const qrCodePath = result.id.includes('_inst_') ? `/api/events/${result.id}/qr.png` : (result.qrCodePath?.includes('/api/') ? result.qrCodePath : `/api/events/${result.id}/qr.png`);

	// 4. Return Data
	if (!isAuthorized) {
		// Public safe object
		const publicSafeEvent = {
			id: result.id,
			summary: result.summary,
			description: result.description,
			status: result.status,
			startDateTime: toIsoSafe(result.startDateTime),
			endDateTime: toIsoSafe(result.endDateTime),
			isAllDay: result.isAllDay,
			isPublic: result.isPublic,
			heroImage: result.heroImage,
			ticketPrice: result.ticketPrice,
			ticketPriceUnknown: result.ticketPriceUnknown,
			categoryBerlinDotDe: result.categoryBerlinDotDe,
			createdAt: toIsoSafe(result.createdAt) ?? new Date().toISOString(),
			updatedAt: toIsoSafe(result.updatedAt) ?? new Date().toISOString(),
			locations: publicLocations,
			resources: publicResources,
			rooms: getEventRooms({ locations: publicLocations, resources: publicResources }),
			locationIds: publicLocations.map((l: any) => l.id),
			resourceIds: publicResources.map((r: any) => r.id),
			tags: result.tags.map((t: any) => ({ id: t.tag.id, name: t.tag.name })),
			resolvedContact,
			contactIds: [],
			syncIds: [],
			menus: eventMenus,
			menuIds: (result.menus || []).map((m: any) => m.menuId),
			iCalPath,
			qrCodePath,
			seriesMaster: seriesMaster ?? undefined,
			instances: instances.length > 0 ? instances : undefined,
		} as any;

		await setCache(cacheKeys.publicEvent(eventId), { isPrivate: false, data: publicSafeEvent }, 3600);
		return publicSafeEvent;
	}

	const allLocations = result.locations.map((l: any) => l.location);
	const allResources = result.resources.map((r: any) => r.resource).filter(Boolean);
	const allContacts = (result.contacts || []).map((c: any) => ({
		...(c.contact || c),
		participationStatus: c.participationStatus || 'needsAction'
	})).filter((c: any) => c && c.id);

	// Full object
	return {
		...result,
		iCalPath,
		qrCodePath,
		createdAt: toIsoSafe(result.createdAt) ?? new Date().toISOString(),
		updatedAt: toIsoSafe(result.updatedAt) ?? new Date().toISOString(),
		startDateTime: toIsoSafe(result.startDateTime),
		endDateTime: toIsoSafe(result.endDateTime),
		locations: allLocations,
		resources: allResources,
		contacts: allContacts,
		menus: eventMenus,
		menuIds: (result.menus || []).map((m: any) => m.menuId),
		rooms: getEventRooms({ locations: allLocations, resources: allResources }),
		resourceIds: result.resources.map((r: any) => r.resourceId),
		contactIds: result.contacts.map((c: any) => c.contactId),
		locationIds: result.locations.map((l: any) => l.locationId),
		tags: result.tags.map((t: any) => ({ id: t.tag.id, name: t.tag.name })),
		syncIds: getCampaignTargetIds(result.campaign?.content),
		resolvedContact,
		seriesMaster: seriesMaster ?? undefined,
		instances: instances.length > 0 ? instances : undefined,
	} as any;
});
