import * as v from 'valibot';
import { query } from '$app/server';
import { db, event, recurringSeries, eventContact, eventLocation, eventResource, resource, eventTag, contact, location, tag, locationContact, eq, ne, notInArray, inArray, and, or, not, ilike, sql, desc, asc, exists, isNull, isNotNull, gte, lte, alias } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { eventPaginationSchema as PaginationSchema, parseFilterValue, type PaginatedResult, type Event } from '@ac/validations';
import { getEventRooms } from '$lib/utils/format-rooms';
import { resolveEventContactSync, isEmployeeContact } from '$lib/server/contact-resolution';

export const listEvents = query(PaginationSchema, async (input: v.InferOutput<typeof PaginationSchema>): Promise<PaginatedResult<any>> => {
	let hasAccess = false;
	try {
		const user = getAuthenticatedUser();
		ensureAccess(user, 'events');
		hasAccess = true;
	} catch (e) {
		// unauthorized can only see public events
	}

	const { page = 1, limit = 50, search = '', locationId, tagId, contactId, sortField = 'updatedAt', sortOrder = 'desc', excludeTentative, excludeCancelled, excludeNonPublic, excludePast, excludeSeries, onlySeries, includeSeriesEntries, excludedEventIds, includedEventIds, excludedTags, includedTags, startDate, endDate } = input || {};
	const offset = (page - 1) * limit;

	let baseQuery = db.select({ id: event.id }).from(event).$dynamic();
	const conditions: any[] = [];
	if (!includeSeriesEntries) {
		conditions.push(isNull(event.recurringEventId));
	}

	if (!hasAccess) {
		conditions.push(eq(event.isPublic, true));
	}

	// Search filter: Summary, Description, Location Names, Contact Names
	if (search) {
		const searchPattern = `%${search}%`;
		conditions.push(or(
			ilike(event.summary, searchPattern),
			ilike(event.description, searchPattern),
			sql`EXISTS (
				SELECT 1 FROM ${eventLocation} el
				JOIN ${location} l ON el.location_id = l.id
				WHERE el.event_id = ${event.id} AND l.name ILIKE ${searchPattern}
			)`,
			sql`EXISTS (
				SELECT 1 FROM ${eventContact} ec
				JOIN ${contact} c ON ec.contact_id = c.id
				WHERE ec.event_id = ${event.id} AND (c.display_name ILIKE ${searchPattern} OR c.given_name ILIKE ${searchPattern} OR c.family_name ILIKE ${searchPattern})
			)`
		));
	}

	// Location filter (include / exclude)
	if (locationId) {
		const { include, exclude } = parseFilterValue(locationId);
		if (include.length > 0) {
			conditions.push(
				or(
					exists(
						db.select({ id: sql`1` })
						  .from(eventLocation)
						  .where(and(eq(eventLocation.eventId, event.id), inArray(eventLocation.locationId, include)))
					),
					exists(
						db.select({ id: sql`1` })
						  .from(eventResource)
						  .innerJoin(resource, eq(eventResource.resourceId, resource.id))
						  .where(and(eq(eventResource.eventId, event.id), inArray(resource.locationId, include)))
					)
				)
			);
		}
		if (exclude.length > 0) {
			conditions.push(
				and(
					not(exists(
						db.select({ id: sql`1` })
						  .from(eventLocation)
						  .where(and(eq(eventLocation.eventId, event.id), inArray(eventLocation.locationId, exclude)))
					)),
					not(exists(
						db.select({ id: sql`1` })
						  .from(eventResource)
						  .innerJoin(resource, eq(eventResource.resourceId, resource.id))
						  .where(and(eq(eventResource.eventId, event.id), inArray(resource.locationId, exclude)))
					))
				)
			);
		}
	}

	// Tag filter (include / exclude)
	if (tagId) {
		const { include, exclude } = parseFilterValue(tagId);
		if (include.length > 0) {
			conditions.push(
				exists(
					db.select({ id: sql`1` })
					  .from(eventTag)
					  .where(and(eq(eventTag.eventId, event.id), inArray(eventTag.tagId, include)))
				)
			);
		}
		if (exclude.length > 0) {
			conditions.push(
				not(exists(
					db.select({ id: sql`1` })
					  .from(eventTag)
					  .where(and(eq(eventTag.eventId, event.id), inArray(eventTag.tagId, exclude)))
				))
			);
		}
	}

	// Contact filter (include / exclude)
	if (contactId) {
		const { include, exclude } = parseFilterValue(contactId);
		if (include.length > 0) {
			conditions.push(
				exists(
					db.select({ id: sql`1` })
					  .from(eventContact)
					  .where(and(eq(eventContact.eventId, event.id), inArray(eventContact.contactId, include)))
				)
			);
		}
		if (exclude.length > 0) {
			conditions.push(
				not(exists(
					db.select({ id: sql`1` })
					  .from(eventContact)
					  .where(and(eq(eventContact.eventId, event.id), inArray(eventContact.contactId, exclude)))
				))
			);
		}
	}

	// Advanced Kiosk filters
	const conditionalFilters = [];
	
	if (excludeTentative) {
		conditionalFilters.push(ne(event.status, 'tentative'));
	}
	
	if (excludeCancelled) {
		conditionalFilters.push(ne(event.status, 'cancelled'));
	}
	
	if (excludeNonPublic) {
		conditionalFilters.push(eq(event.isPublic, true));
	}

	if (excludeSeries) {
		conditionalFilters.push(
			and(
				isNull(event.seriesId),
				or(
					isNull(event.recurrence),
					sql`${event.recurrence} = '[]'::jsonb`
				)
			)
		);
	}

	if (onlySeries) {
		conditionalFilters.push(
			or(
				isNotNull(event.seriesId),
				and(
					isNotNull(event.recurrence),
					sql`${event.recurrence} != '[]'::jsonb`
				)
			)
		);
	}

	if (excludePast) {
		const cutoff = new Date();
		cutoff.setHours(0, 0, 0, 0);

		const instanceEvent = alias(event, 'instance_event');

		conditionalFilters.push(
			or(
				gte(event.startDateTime, cutoff),
				gte(event.endDateTime, cutoff),
				isNotNull(event.recurrence),
				isNotNull(event.seriesId),
				exists(
					db.select({ id: sql`1` })
					  .from(instanceEvent)
					  .where(
						  and(
							  eq(instanceEvent.recurringEventId, event.id),
							  or(
								  gte(instanceEvent.startDateTime, cutoff),
								  gte(instanceEvent.endDateTime, cutoff)
							  )
						  )
					  )
				)
			)
		);
	}
	
	if (startDate) {
		const startD = new Date(startDate);
		conditionalFilters.push(or(
			gte(event.startDateTime, startD),
			gte(event.endDateTime, startD)
		));
	}
	
	if (endDate) {
		conditionalFilters.push(lte(event.startDateTime, new Date(endDate)));
	}
	
	if (excludedTags && excludedTags.length > 0) {
		// exclude events that have any of these tag names
		conditionalFilters.push(
			sql`NOT EXISTS (
				SELECT 1 FROM ${eventTag} et
				JOIN ${tag} t ON et.tag_id = t.id
				WHERE et.event_id = ${event.id} AND t.name IN (${sql.join(excludedTags.map(t => sql`${t}`), sql`, `)})
			)`
		);
	}
	
	if (includedTags && includedTags.length > 0) {
		// include events that have these tag names
		conditionalFilters.push(
			sql`EXISTS (
				SELECT 1 FROM ${eventTag} et
				JOIN ${tag} t ON et.tag_id = t.id
				WHERE et.event_id = ${event.id} AND t.name IN (${sql.join(includedTags.map(t => sql`${t}`), sql`, `)})
			)`
		);
	}

	if (excludedEventIds && excludedEventIds.length > 0) {
		conditionalFilters.push(notInArray(event.id, excludedEventIds));
	}

	if (includedEventIds && includedEventIds.length > 0) {
		// If explicit inclusion is present, it ORs with the conditions, but we still respect isPublic if unauth
		const explicitInclusion = inArray(event.id, includedEventIds);
		if (conditionalFilters.length > 0 || conditions.length > (hasAccess ? 1 : 2)) {
			// Combine the standard filters, then OR with explicit inclusion
			const standardFilters = and(...conditions, ...conditionalFilters);
			// Overwrite conditions so we just apply this top level OR
			conditions.length = 0;
			conditions.push(or(standardFilters, explicitInclusion));
			
			// Re-apply access restriction if needed so included events must still be public
			if (!hasAccess) {
				conditions.push(eq(event.isPublic, true));
			}
			// And keep the recurringEventId restriction
			conditions.push(isNull(event.recurringEventId));
		} else {
			// Just normal pushing
			conditions.push(explicitInclusion);
		}
	} else {
		conditions.push(...conditionalFilters);
	}

	if (conditions.length > 0) {
		baseQuery = baseQuery.where(and(...conditions as any)) as any;
	}

	// Total count
	const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
	const total = Number(countResult[0]?.count || 0);

	// Sorting
	let orderField: any = event.updatedAt;
	if (sortField === 'startDateTime') orderField = event.startDateTime;
	else if (sortField === 'createdAt') orderField = event.createdAt;

	const orderExpression = sortOrder === 'desc' ? sql`${orderField} desc nulls last` : sql`${orderField} asc nulls last`;

	// Pagination
	const paginatedIdsResult = await baseQuery
		.orderBy(orderExpression)
		.limit(limit)
		.offset(offset);

	const ids = paginatedIdsResult.map(r => r.id);

	if (ids.length === 0) {
		return { data: [], total };
	}

	// Fetch full data for the paginated IDs
	const rawResults = await db.query.event.findMany({
		where: includeSeriesEntries ? inArray(event.id, ids) : or(inArray(event.id, ids), inArray(event.recurringEventId, ids)),
		with: {
			contacts: {
				with: {
					contact: {
						with: {
							emails: true,
							phones: true,
							tags: {
								with: {
									tag: true
								}
							}
						}
					}
				}
			},
			locations: {
				with: {
					location: true
				}
			},
			resources: {
				with: {
					resource: true
				}
			},
			tags: {
				with: {
					tag: true
				}
			},
			campaign: true,
			user: true
		},
		orderBy: [orderExpression]
	});

	// If includeSeriesEntries and date window is specified, also check for any recurring series masters that have instances in this window
	if (includeSeriesEntries && startDate && endDate && !excludeSeries) {
		const startD = new Date(startDate);
		const endD = new Date(endDate);

		const masters = await db.query.event.findMany({
			where: and(
				isNull(event.recurringEventId),
				or(
					isNotNull(event.seriesId),
					and(isNotNull(event.recurrence), sql`${event.recurrence} != '[]'::jsonb`)
				),
				lte(event.startDateTime, endD),
				hasAccess ? sql`true` : eq(event.isPublic, true),
				excludeTentative ? ne(event.status, 'tentative') : sql`true`,
				excludeCancelled ? ne(event.status, 'cancelled') : sql`true`,
				excludeNonPublic ? eq(event.isPublic, true) : sql`true`
			),
			with: {
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
				locations: { with: { location: true } },
				resources: { with: { resource: true } },
				tags: { with: { tag: true } },
				campaign: true,
				user: true
			}
		});

		if (masters.length > 0) {
			const { expandRecurrence } = await import('$lib/server/events/recurrence');
			const existingKeys = new Set(
				rawResults.map((r: any) => {
					const masterId = r.recurringEventId || r.id;
					const time = r.startDateTime ? new Date(r.startDateTime).getTime() : 0;
					return `${masterId}_${time}`;
				})
			);

			for (const master of masters) {
				let rruleStr: string | null = null;
				if (master.recurrence && Array.isArray(master.recurrence) && master.recurrence[0]) {
					rruleStr = master.recurrence[0];
				} else if (master.seriesId) {
					const [seriesRecord] = await db.select().from(recurringSeries).where(eq(recurringSeries.id, master.seriesId));
					if (seriesRecord?.rrule) rruleStr = seriesRecord.rrule;
				}

				if (!rruleStr || !master.startDateTime) continue;

				const masterTime = new Date(master.startDateTime).getTime();
				if (masterTime >= startD.getTime() && masterTime <= endD.getTime()) {
					const key = `${master.id}_${masterTime}`;
					if (!existingKeys.has(key)) {
						rawResults.push(master);
						existingKeys.add(key);
					}
				}

				const instances = expandRecurrence(
					rruleStr,
					new Date(master.startDateTime),
					master.endDateTime ? new Date(master.endDateTime) : null,
					100,
					false,
					master.startTimeZone
				);

				for (const inst of instances) {
					const instTime = inst.date.getTime();
					if (instTime >= startD.getTime() && instTime <= endD.getTime()) {
						const key = `${master.id}_${instTime}`;
						if (!existingKeys.has(key)) {
							rawResults.push({
								...master,
								id: `${master.id}_inst_${inst.date.toISOString()}`,
								recurringEventId: master.id,
								startDateTime: inst.date,
								endDateTime: inst.end || master.endDateTime
							} as any);
							existingKeys.add(key);
						}
					}
				}
			}
		}
	}

	// Collect location IDs for events that might need location contact fallback
	const neededLocationIds = new Set<string>();
	for (const e of rawResults) {
		const hasEmployee = (e.contacts || []).some((ec: any) => isEmployeeContact(ec.contact || ec));
		if (!hasEmployee) {
			for (const l of e.locations || []) {
				if (l.location?.id) neededLocationIds.add(l.location.id);
				else if (l.locationId) neededLocationIds.add(l.locationId);
			}
			for (const r of e.resources || []) {
				const locId = (r.resource as any)?.locationId;
				if (locId) neededLocationIds.add(locId);
			}
		}
	}

	const locationContactsMap = new Map<string, any[]>();
	if (neededLocationIds.size > 0) {
		const locContactsData = await db.query.locationContact.findMany({
			where: inArray(locationContact.locationId, Array.from(neededLocationIds)),
			with: {
				contact: {
					with: {
						emails: true,
						phones: true,
						tags: {
							with: {
								tag: true
							}
						}
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

	let results = rawResults;
	if (includeSeriesEntries && (startDate || endDate)) {
		const startD = startDate ? new Date(startDate) : null;
		const endD = endDate ? new Date(endDate) : null;
		results = results.filter((e: any) => {
			const s = e.startDateTime ? new Date(e.startDateTime) : null;
			if (startD && s && s < startD) return false;
			if (endD && s && s > endD) return false;
			return true;
		});
	} else if (excludePast) {
		const cutoff = new Date();
		cutoff.setHours(0, 0, 0, 0);

		const instancesByMaster = new Map<string, any[]>();
		for (const item of rawResults) {
			if (item.recurringEventId) {
				const list = instancesByMaster.get(item.recurringEventId) || [];
				list.push(item);
				instancesByMaster.set(item.recurringEventId, list);
			}
		}

		results = rawResults.filter((e: any) => {
			const start = e.startDateTime ? new Date(e.startDateTime) : null;
			const end = e.endDateTime ? new Date(e.endDateTime) : null;
			const isSelfFuture = (start ? start >= cutoff : false) || (end ? end >= cutoff : false);

			if (!e.recurringEventId) {
				// Master or single event
				if (isSelfFuture || e.recurrence || e.seriesId) return true;
				// If master's anchor date is past, check if it has any current/future instances
				const instances = instancesByMaster.get(e.id) || [];
				return instances.some((inst: any) => {
					const iStart = inst.startDateTime ? new Date(inst.startDateTime) : null;
					const iEnd = inst.endDateTime ? new Date(inst.endDateTime) : null;
					return (iStart ? iStart >= cutoff : false) || (iEnd ? iEnd >= cutoff : false);
				});
			} else {
				// Child instance event
				return isSelfFuture;
			}
		});
	}

	const data = results.map((e: any) => {
		const evtLocations = (e.locations?.map((l: any) => l.location).filter(Boolean) || []).map((loc: any) => ({
			...loc,
			locationContacts: locationContactsMap.get(loc.id) || []
		}));
		const evtResources = e.resources?.map((r: any) => r.resource).filter(Boolean) || [];
		const rooms = getEventRooms({ locations: evtLocations, resources: evtResources });

		const resWithLocContacts = evtResources.map((res: any) => {
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
			...e,
			locations: evtLocations,
			resources: resWithLocContacts
		}, {
			filterWorkOnly: !hasAccess,
			fallbackToLocation: true,
			fallbackToFirst: true
		});

		const isSeries = Boolean(
			e.seriesId ||
			e.recurringEventId ||
			(e.recurrence && (e.recurrence as any[]).length > 0)
		);

		return {
			...e,
			isSeries,
			qrCodePath: e.qrCodePath?.includes('/api/') ? e.qrCodePath : `/api/events/${e.id}/qr.png`,
			startDateTime: e.startDateTime ? (e.startDateTime instanceof Date ? e.startDateTime.toISOString() : new Date(e.startDateTime).toISOString()) : null,
			endDateTime: e.endDateTime ? (e.endDateTime instanceof Date ? e.endDateTime.toISOString() : new Date(e.endDateTime).toISOString()) : null,
			createdAt: e.createdAt ? (e.createdAt instanceof Date ? e.createdAt.toISOString() : new Date(e.createdAt).toISOString()) : null,
			updatedAt: e.updatedAt ? (e.updatedAt instanceof Date ? e.updatedAt.toISOString() : new Date(e.updatedAt).toISOString()) : null,
			locations: evtLocations,
			resources: evtResources,
			rooms,
			locationIds: evtLocations.map((l: any) => l.id),
			resourceIds: evtResources.map((r: any) => r.id),
			tags: e.tags?.map((t: any) => t.tag || t).filter(Boolean) || [],
			resolvedContact,
		};
	});

	if (sortField === 'startDateTime' || includeSeriesEntries) {
		data.sort((a: any, b: any) => {
			const timeA = a.startDateTime ? new Date(a.startDateTime).getTime() : 0;
			const timeB = b.startDateTime ? new Date(b.startDateTime).getTime() : 0;
			return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
		});
	}

	return { data, total: includeSeriesEntries ? data.length : total };
});

