import * as v from 'valibot';
import { query } from '$app/server';
import { event, eventTag, tag, campaign } from '@ac/db';
import type { Event as DbEvent } from '@ac/db';
import { db } from '@ac/db';
import { eq, desc, inArray, ilike, and, sql } from '@ac/db';
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

	const { page, limit, locationId, tagId, contactId, search, grouped, seriesId } = input;
	const offset = (page - 1) * limit;

	// Build the base query for filtering
	let baseQuery = db.select({ 
		id: event.id,
		seriesId: event.seriesId,
		createdAt: event.createdAt,
		summary: event.summary,
		startDateTime: event.startDateTime
	}).from(event);
	
	const conditions = [];
	
	if (seriesId) {
		conditions.push(eq(event.seriesId, seriesId));
	}

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
	
	if (search) {
		conditions.push(ilike(event.summary, `%${search}%`));
	}

	if (conditions.length > 0) {
		baseQuery = baseQuery.where(and(...conditions)) as any;
	}

	let total = 0;
	let paginatedIds: string[] = [];
	const instanceCounts = new Map<string, number>();

	const subquery = baseQuery.as('filtered_events');

	if (grouped) {
		const groupsQuery = db.select({
			representativeId: sql<string>`(array_agg(${subquery.id} ORDER BY ${subquery.startDateTime} ASC NULLS LAST))[1]`,
			count: sql<number>`count(*)::int`,
		})
		.from(subquery)
		.groupBy(sql`COALESCE(${subquery.seriesId}, ${subquery.id})`)
		.orderBy(sql`max(${subquery.createdAt}) DESC`);

		const allGroups = await groupsQuery;
		total = allGroups.length;
		
		const pagedGroups = allGroups.slice(offset, offset + limit);
		paginatedIds = pagedGroups.map(g => g.representativeId).filter(Boolean);
		
		for (const g of pagedGroups) {
			if (g.representativeId) {
				instanceCounts.set(g.representativeId, g.count);
			}
		}
	} else {
		const countResult = await db.select({ count: sql<number>`count(*)::int` }).from(subquery);
		total = Number(countResult[0]?.count || 0);

		if (total > 0) {
			const paginatedIdsQuery = db.select({ id: subquery.id })
				.from(subquery)
				.orderBy(desc(subquery.createdAt))
				.limit(limit)
				.offset(offset);
			const rows = await paginatedIdsQuery;
			paginatedIds = rows.map((r) => r.id);
		}
	}

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
		iCalPath: row.iCalPath?.includes('/api/') ? row.iCalPath : `/api/events/${row.id}/event.ics`,
		qrCodePath: row.qrCodePath?.includes('/api/') ? row.qrCodePath : `/api/events/${row.id}/qr.png`,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		startDateTime: row.startDateTime?.toISOString() ?? null,
		endDateTime: row.endDateTime?.toISOString() ?? null,
		isSeries: (grouped && (instanceCounts.get(row.id) ?? 1) > 1) || (!!row.seriesId && grouped),
		instanceCount: grouped ? (instanceCounts.get(row.id) ?? 1) : 1,
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

