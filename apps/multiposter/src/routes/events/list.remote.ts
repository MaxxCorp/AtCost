import * as v from 'valibot';
import { query } from '$app/server';
import { event, eventTag, tag, campaign } from '@ac/db';
import type { Event as DbEvent } from '@ac/db';
import { db } from '$lib/server/db';
import { eq, desc, inArray, ilike, and, sql } from 'drizzle-orm';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';

/**
 * Event interface matching the database schema, with dates serialized to strings
 */
import { eventPaginationSchema as PaginationSchema, type Event, type PaginatedResult } from '@ac/validations';



/**
 * List all events for the authenticated user, paginated.
 */
export const listEvents = query(PaginationSchema, async (input): Promise<PaginatedResult<Event>> => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'events');

	const { page, limit, locationId, tagId, contactId, search } = input;
	const offset = (page - 1) * limit;

	// Build the base query for filtering
	let baseQuery = db.select({ id: event.id }).from(event);
	
	const conditions = [];
	// Actually we should filter by locationId if provided:
	if (locationId) {
		const { eventLocation } = await import('@ac/db');
		baseQuery = baseQuery.innerJoin(eventLocation, eq(eventLocation.eventId, event.id)) as any;
		const ids = Array.isArray(locationId) ? locationId : [locationId];
		conditions.push(inArray(eventLocation.locationId, ids));
	}

	if (tagId) {
		const { eventTag } = await import('@ac/db');
		baseQuery = baseQuery.innerJoin(eventTag, eq(eventTag.eventId, event.id)) as any;
		const ids = Array.isArray(tagId) ? tagId : [tagId];
		conditions.push(inArray(eventTag.tagId, ids));
	}

	if (contactId) {
		const { eventContact } = await import('@ac/db');
		baseQuery = baseQuery.innerJoin(eventContact, eq(eventContact.eventId, event.id)) as any;
		const ids = Array.isArray(contactId) ? contactId : [contactId];
		conditions.push(inArray(eventContact.contactId, ids));
	}
	
	// Add search logic if needed (e.g., ilike summary)
	if (search) {
		conditions.push(ilike(event.summary, `%${search}%`));
	}

	if (conditions.length > 0) {
		baseQuery = baseQuery.where(and(...conditions)) as any;
	}

	// First, get total count (doing a simple count of the filtered IDs)
	const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult[0]?.count || 0);

	if (total === 0) {
		return { data: [], total: 0 };
	}

	// Then, fetch paginated records
	const paginatedIdsQuery = baseQuery.orderBy(desc(event.createdAt)).limit(limit).offset(offset);
	const paginatedIds = (await paginatedIdsQuery).map((r) => r.id);

	if (paginatedIds.length === 0) {
		return { data: [], total };
	}

	const rawResults = await db
		.select()
		.from(event)
		.where(inArray(event.id, paginatedIds))
		.orderBy(desc(event.createdAt));

	const results = rawResults.map((row) => ({
		...row,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		startDateTime: row.startDateTime?.toISOString() ?? null,
		endDateTime: row.endDateTime?.toISOString() ?? null,
	}));

	// Fetch tags for these paginated events
	const eventIds = results.map((e) => e.id);
	const tagsForEvents = await db
		.select({
			eventId: eventTag.eventId,
			tagId: tag.id,
			tagName: tag.name,
		})
		.from(eventTag)
		.innerJoin(tag, eq(eventTag.tagId, tag.id))
		.where(inArray(eventTag.eventId, eventIds));

	// Map tags to events
	const tagsMap = new Map<string, { id: string, name: string }[]>();
	for (const { eventId, tagId, tagName } of tagsForEvents) {
		if (!tagsMap.has(eventId)) {
			tagsMap.set(eventId, []);
		}
		if (tagName) {
			tagsMap.get(eventId)?.push({ id: tagId, name: tagName });
		}
	}

	// Fetch campaigns for all events
	const campaignIds = results.map((e) => e.campaignId).filter(Boolean) as string[];
	const campaignsMap = new Map<string, string[]>();
	if (campaignIds.length > 0) {
		const campaigns = await db
			.select({ id: campaign.id, content: campaign.content })
			.from(campaign)
			.where(inArray(campaign.id, campaignIds));
		for (const c of campaigns) {
			campaignsMap.set(c.id, (c.content as any)?.syncIds || []);
		}
	}

	// Attach tags and syncIds to results
	const processedData = results.map((e) => ({
		...e,
		tags: tagsMap.get(e.id) || [],
		syncIds: e.campaignId ? campaignsMap.get(e.campaignId) || [] : [],
	}));
	
	// Maintain the original requested sorting order by looping the results
	const sortedData = paginatedIds.map(id => processedData.find(d => d.id === id)!).filter(Boolean);

	return {
		data: sortedData,
		total,
	};
});
