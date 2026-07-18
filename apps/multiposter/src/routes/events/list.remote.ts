import * as v from 'valibot';
import { query } from '$app/server';
import { db, event, eventContact, eventLocation, eventResource, resource, eventTag, contact, location, tag, eq, ne, notInArray, inArray, and, or, ilike, sql, desc, asc, exists, isNull, gte, lte } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { eventPaginationSchema as PaginationSchema, type PaginatedResult, type Event } from '@ac/validations';

export const listEvents = query(PaginationSchema, async (input: v.InferOutput<typeof PaginationSchema>): Promise<PaginatedResult<any>> => {
	let hasAccess = false;
	try {
		const user = getAuthenticatedUser();
		ensureAccess(user, 'events');
		hasAccess = true;
	} catch (e) {
		// unauthorized can only see public events
	}

	const { page = 1, limit = 50, search = '', locationId, tagId, contactId, sortField = 'updatedAt', sortOrder = 'desc', excludeTentative, excludeCancelled, excludeNonPublic, excludedEventIds, includedEventIds, excludedTags, includedTags, startDate, endDate } = input || {};
	const offset = (page - 1) * limit;

	let baseQuery = db.select({ id: event.id }).from(event).$dynamic();
	const conditions: any[] = [isNull(event.recurringEventId)];

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

	// Location filter
	if (locationId) {
		const ids = Array.isArray(locationId) ? locationId : [locationId];
		if (ids.length > 0) {
			conditions.push(
				or(
					exists(
						db.select({ id: sql`1` })
						  .from(eventLocation)
						  .where(and(eq(eventLocation.eventId, event.id), inArray(eventLocation.locationId, ids)))
					),
					exists(
						db.select({ id: sql`1` })
						  .from(eventResource)
						  .innerJoin(resource, eq(eventResource.resourceId, resource.id))
						  .where(and(eq(eventResource.eventId, event.id), inArray(resource.locationId, ids)))
					)
				)
			);
		}
	}

	// Tag filter
	if (tagId) {
		const ids = Array.isArray(tagId) ? tagId : [tagId];
		if (ids.length > 0) {
			conditions.push(
				exists(
					db.select({ id: sql`1` })
					  .from(eventTag)
					  .where(and(eq(eventTag.eventId, event.id), inArray(eventTag.tagId, ids)))
				)
			);
		}
	}

	// Contact filter
	if (contactId) {
		const ids = Array.isArray(contactId) ? contactId : [contactId];
		if (ids.length > 0) {
			conditions.push(
				exists(
					db.select({ id: sql`1` })
					  .from(eventContact)
					  .where(and(eq(eventContact.eventId, event.id), inArray(eventContact.contactId, ids)))
				)
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
	
	if (startDate) {
		conditionalFilters.push(or(
            gte(event.endDateTime, new Date(startDate)),
            and(isNull(event.endDateTime), gte(event.startDateTime, new Date(startDate)))
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
		where: or(inArray(event.id, ids), inArray(event.recurringEventId, ids)),
		with: {
			contacts: true,
			locations: {
				with: {
					location: true
				}
			},
			resources: true,
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

	return { data: rawResults, total };
});
