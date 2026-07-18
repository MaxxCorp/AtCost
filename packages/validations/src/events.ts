import * as v from 'valibot';
import type { Event as DbEvent } from '@ac/db';
import type { Tag } from './tags.js';

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
	tags?: Tag[];
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
	isSeries?: boolean;
	instanceCount?: number;
	instances?: Event[];
};


import { FilterableIdSchema } from './pagination.js';

export const eventPaginationSchema = v.optional(v.object({
	page: v.optional(v.number(), 1),
	limit: v.optional(v.number(), 50),
	search: v.optional(v.string()),
	locationId: FilterableIdSchema,
	tagId: FilterableIdSchema,
	contactId: FilterableIdSchema,
	sortField: v.optional(v.union([v.literal('updatedAt'), v.literal('startDateTime'), v.literal('createdAt')])),
	sortOrder: v.optional(v.union([v.literal('asc'), v.literal('desc')])),
	grouped: v.optional(v.boolean(), false),
	seriesId: v.optional(v.string()),
    excludeTentative: v.optional(v.boolean()),
    excludeCancelled: v.optional(v.boolean()),
    excludeNonPublic: v.optional(v.boolean()),
    excludedEventIds: v.optional(v.array(v.string())),
    includedEventIds: v.optional(v.array(v.string())),
    excludedTags: v.optional(v.array(v.string())),
    includedTags: v.optional(v.array(v.string())),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
}), {});
