import * as v from 'valibot';
import { query } from '$app/server';
import { db, event, eventContact, eventLocation, eventTag, contact, location, tag, eq, inArray, and, or, ilike, sql, desc, asc, exists, isNull } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { eventPaginationSchema as PaginationSchema, type PaginatedResult, type Event } from '@ac/validations';

export const listEvents = query(PaginationSchema, async (input: v.InferOutput<typeof PaginationSchema>): Promise<PaginatedResult<any>> => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'events');

	const { page = 1, limit = 50, search = '', locationId, tagId, contactId, sortField = 'updatedAt', sortOrder = 'desc' } = input || {};
	const offset = (page - 1) * limit;

	let baseQuery = db.select({ id: event.id }).from(event).$dynamic();
	const conditions: any[] = [isNull(event.recurringEventId)];

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
				exists(
					db.select({ id: sql`1` })
					  .from(eventLocation)
					  .where(and(eq(eventLocation.eventId, event.id), inArray(eventLocation.locationId, ids)))
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
