import * as v from 'valibot';
import { query } from '$app/server';
import { event, eventTag, tag, campaign } from '@ac/db';
import type { Event as DbEvent } from '@ac/db';
import { db } from '$lib/server/db';
import { eq, desc, inArray } from 'drizzle-orm';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';

/**
 * Event interface matching the database schema, with dates serialized to strings
 */
export type Event = Omit<DbEvent, 'createdAt' | 'updatedAt' | 'startDateTime' | 'endDateTime'> & {
	createdAt: string;
	updatedAt: string;
	startDateTime: string | null;
	endDateTime: string | null;
	resourceIds?: string[];
	contactIds?: string[];
	locationIds?: string[];
	locations?: {
		id: string;
		name: string;
		street: string | null;
		houseNumber: string | null;
		zip: string | null;
		city: string | null;
		country: string | null;
		isPublic: boolean;
	}[];
	tags?: string[];
	syncIds?: string[];
	participationStatuses?: Record<string, string>;
	maxOccupancy?: number | null;
	resolvedContact?: {
		name: string;
		email: string;
		phone: string;
		qrCodeDataUrl?: string;
	} | null;
	qrCodePath?: string | null;
	iCalPath?: string | null;
};

/**
 * List all events for the authenticated user
 */
export const listEvents = query(v.undefined_(), async (): Promise<Event[]> => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'events');

	const rawResults = await db
		.select()
		.from(event)
		.orderBy(desc(event.createdAt));

	const results = rawResults.map((row) => ({
		...row,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		startDateTime: row.startDateTime?.toISOString() ?? null,
		endDateTime: row.endDateTime?.toISOString() ?? null,
	}));

	if (results.length === 0) {
		return [];
	}

	// Fetch tags for all events
	const eventIds = results.map((e) => e.id);
	const tagsForEvents = await db
		.select({
			eventId: eventTag.eventId,
			tagName: tag.name,
		})
		.from(eventTag)
		.innerJoin(tag, eq(eventTag.tagId, tag.id))
		.where(inArray(eventTag.eventId, eventIds));

	// Map tags to events
	const tagsMap = new Map<string, string[]>();
	for (const { eventId, tagName } of tagsForEvents) {
		if (!tagsMap.has(eventId)) {
			tagsMap.set(eventId, []);
		}
		if (tagName) {
			tagsMap.get(eventId)?.push(tagName);
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
	return results.map((event) => ({
		...event,
		tags: tagsMap.get(event.id) || [],
		syncIds: event.campaignId ? campaignsMap.get(event.campaignId) || [] : [],
	}));
});
