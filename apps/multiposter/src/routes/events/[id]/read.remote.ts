import { query } from '$app/server';
import { db } from '@ac/db';
import { event, locationContact, recurringSeries, inArray, eq, or, and, sql } from '@ac/db';
import { getOptionalUser, hasAccess } from '#lib/server/authorization.js';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { type Event, getCampaignTargetIds } from '@ac/validations';
import { getEventRooms } from '#lib/utils/format-rooms.js';
import { resolveEventContactSync, isEmployeeContact } from '#lib/server/contact-resolution.js';
import { getCache, setCache, cacheKeys } from '#lib/server/cache/index.js';
import { getSeriesInstances } from '#lib/server/events/instances.js';
import { sanitizePublicEvent, filterPublicTags } from '#lib/server/public-sanitization.js';

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
			return cachedPayload.data ? (sanitizePublicEvent(cachedPayload.data) as any) : null;
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
				resources: { with: { resource: { with: { location: true } } } },
				contactRoles: { with: { role: true } },
				tags: { with: { tag: true } },
				campaign: true,
				prices: {
					with: {
						price: {
							with: {
								items: {
									with: {
										consumable: {
											with: {
												tags: { with: { tag: { with: { category: true } } } }
											}
										},
										recipe: {
											with: {
												tags: { with: { tag: { with: { category: true } } } }
											}
										},
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
					resources: { with: { resource: { with: { location: true } } } },
					contactRoles: { with: { role: true } },
					tags: { with: { tag: true } },
					campaign: true,
					prices: {
						with: {
							price: {
								with: {
									items: {
										with: {
											consumable: {
												with: {
													tags: { with: { tag: { with: { category: true } } } }
												}
											},
											recipe: {
												with: {
													tags: { with: { tag: { with: { category: true } } } }
												}
											},
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
				resources: { with: { resource: { with: { location: true } } } },
				contactRoles: { with: { role: true } },
				tags: { with: { tag: true } },
				campaign: true,
				prices: {
					with: {
						price: {
							with: {
								items: {
									with: {
										consumable: {
											with: {
												tags: { with: { tag: { with: { category: true } } } }
											}
										},
										recipe: {
											with: {
												tags: { with: { tag: { with: { category: true } } } }
											}
										},
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
	const contactRolesMap = new Map<string, { id: string; name: string; color: string }[]>();
	for (const cr of (result.contactRoles || [])) {
		const list = contactRolesMap.get(cr.contactId) || [];
		if (cr.role) {
			list.push({ id: cr.role.id, name: cr.role.name, color: cr.role.color });
		}
		contactRolesMap.set(cr.contactId, list);
	}

	const allContacts = (result.contacts || []).map((c: any) => {
		const contactObj = c.contact || c;
		return {
			...contactObj,
			roles: contactRolesMap.get(contactObj.id) || [],
			participationStatus: c.participationStatus || 'needsAction'
		};
	}).filter((c: any) => c && c.id);

	const hasEligibleEventEmployee = allContacts.some(
		(ec: any) => ec.isPublic === true && isEmployeeContact(ec)
	);
	const locationContactsMap = new Map<string, any[]>();

	if (!hasEligibleEventEmployee) {
		const neededLocationIds = new Set<string>();
		for (const l of result.locations || []) {
			if (l.location && !l.location.isPublic) continue;
			if (l.location?.id) neededLocationIds.add(l.location.id);
		}
		for (const r of result.resources || []) {
			const res = r.resource as any;
			if (res?.location && !res.location.isPublic) continue;
			const locId = res?.locationId;
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
					...(res.location || {}),
					id: res.locationId,
					locationContacts: locationContactsMap.get(res.locationId) || []
				}
			};
		}
		return res;
	});

	const resolvedContact = resolveEventContactSync({
		...result,
		contacts: allContacts,
		locations: evtLocations,
		resources: evtResources
	}, {
		filterWorkOnly: true,
		publicOnly: true,
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
		} else {
			masterRecord = result;
		}

		// Do not expose seriesMaster or sibling instances if the master is private and viewer is unauthorized
		if (masterRecord && (isAuthorized || masterRecord.isPublic === true)) {
			let masterRrule: string[] | null = masterRecord.recurrence
				? (Array.isArray(masterRecord.recurrence) ? masterRecord.recurrence : [masterRecord.recurrence])
				: null;

			if ((!masterRrule || masterRrule.length === 0) && masterRecord.seriesId) {
				const [seriesRecord] = await db
					.select({ rrule: recurringSeries.rrule })
					.from(recurringSeries)
					.where(eq(recurringSeries.id, masterRecord.seriesId));
				if (seriesRecord?.rrule) {
					masterRrule = [seriesRecord.rrule];
				}
			}

			instances = await getSeriesInstances(
				{
					...masterRecord,
					recurrence: masterRrule,
				},
				100,
				{ publicOnly: !isAuthorized }
			);

			seriesMaster = {
				id: masterRecord.id,
				summary: masterRecord.summary,
				startDateTime: masterRecord.startDateTime ? (masterRecord.startDateTime instanceof Date ? masterRecord.startDateTime.toISOString() : new Date(masterRecord.startDateTime).toISOString()) : null,
				endDateTime: masterRecord.endDateTime ? (masterRecord.endDateTime instanceof Date ? masterRecord.endDateTime.toISOString() : new Date(masterRecord.endDateTime).toISOString()) : null,
				recurrence: masterRrule,
				isPublic: Boolean(masterRecord.isPublic),
				instances: instances.length > 0 ? instances : undefined,
			};

			if (!result.recurringEventId && masterRrule && (!result.recurrence || result.recurrence.length === 0)) {
				result.recurrence = masterRrule;
			}
		}
	}

	const toIsoSafe = (d: any) => {
		if (!d) return null;
		if (d instanceof Date) return d.toISOString();
		const parsed = new Date(d);
		return isNaN(parsed.getTime()) ? null : parsed.toISOString();
	};

	const eventPrices = (result.prices || []).map((ep: any) => {
		const p = ep.price;
		if (!p) return null;
		let totalPricePerPortion = 0;
		let totalCostPerPortion = 0;
		const items = (p.items || []).map((it: any) => {
			const linePrice = (it.unitPrice || 0) * (it.portionAmount || 1);
			const lineCost = (it.costPrice || 0) * (it.portionAmount || 1);
			totalPricePerPortion += linePrice;
			totalCostPerPortion += lineCost;
			const itemTags = it.itemType === 'recipe'
				? (it.recipe?.tags || []).map((t: any) => t.tag || t).filter(Boolean)
				: (it.consumable?.tags || []).map((t: any) => t.tag || t).filter(Boolean);
			return {
				...it,
				tags: isAuthorized ? itemTags : filterPublicTags(itemTags),
				createdAt: it.createdAt ? toIsoSafe(it.createdAt) : undefined,
				updatedAt: it.updatedAt ? toIsoSafe(it.updatedAt) : undefined,
			};
		});
		return {
			...p,
			createdAt: toIsoSafe(p.createdAt),
			updatedAt: toIsoSafe(p.updatedAt),
			items,
			totalPricePerPortion: Math.round(totalPricePerPortion * 100) / 100,
			totalCostPerPortion: Math.round(totalCostPerPortion * 100) / 100,
		};
	}).filter(Boolean);

	const iCalPath = result.id.includes('_inst_') ? `/api/events/${result.id}/event.ics` : (result.iCalPath?.includes('/api/') ? result.iCalPath : `/api/events/${result.id}/event.ics`);
	const qrCodePath = result.id.includes('_inst_') ? `/api/events/${result.id}/qr.png` : (result.qrCodePath?.includes('/api/') ? result.qrCodePath : `/api/events/${result.id}/qr.png`);

	// 4. Return Data
	if (!isAuthorized) {
		const publicSafeEvent = sanitizePublicEvent({
			...result,
			contacts: allContacts,
			locations: evtLocations,
			resources: evtResources,
			prices: eventPrices,
			resolvedContact,
			seriesMaster,
			instances: instances.length > 0 ? instances : undefined,
			iCalPath,
			qrCodePath
		});

		await setCache(cacheKeys.publicEvent(eventId), { isPrivate: false, data: publicSafeEvent }, 3600);
		return publicSafeEvent;
	}

	const allLocations = result.locations.map((l: any) => l.location);
	const allResources = result.resources.map((r: any) => r.resource).filter(Boolean);

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
		prices: eventPrices,
		priceIds: (result.prices || []).map((p: any) => p.priceId),
		rooms: getEventRooms({ locations: allLocations, resources: allResources }),
		resourceIds: result.resources.map((r: any) => r.resourceId),
		contactIds: result.contacts.map((c: any) => c.contactId),
		locationIds: result.locations.map((l: any) => l.locationId),
		tags: result.tags.map((t: any) => ({ id: t.tag.id, name: t.tag.name, visibility: t.tag.visibility })),
		syncIds: getCampaignTargetIds(result.campaign?.content),
		resolvedContact,
		seriesMaster: seriesMaster ?? undefined,
		instances: instances.length > 0 ? instances : undefined,
	} as any;
});
