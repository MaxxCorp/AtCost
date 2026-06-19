import * as v from 'valibot';
import { FilterableIdSchema } from './pagination.js';
import type { Resource as DbResource } from '@ac/db';

export type Resource = Omit<DbResource, 'createdAt' | 'updatedAt'> & {
    locationName: string | null;
    createdAt: string;
    updatedAt: string;
    user?: {
		id: string;
		name: string | null;
		email: string;
	};
};

export const resourcePaginationSchema = v.optional(v.object({
	page: v.optional(v.number(), 1),
	limit: v.optional(v.number(), 50),
	search: v.optional(v.string()),
	locationId: FilterableIdSchema,
    associatedWith: v.optional(v.object({
        type: v.string(),
        id: v.string()
    })),
    sortField: v.optional(v.union([v.literal('updatedAt'), v.literal('createdAt'), v.literal('name')])),
	sortOrder: v.optional(v.union([v.literal('asc'), v.literal('desc')])),
}), {});
export const resourceAssociationSchema = v.object({
    type: v.picklist(['event', 'user', 'location', 'announcement', 'kiosk']),
    entityId: v.string(),
    resourceId: v.pipe(v.string(), v.uuid()),
});

export const getResourceAssociationsSchema = v.object({
    type: v.picklist(['event', 'user', 'location', 'announcement', 'kiosk']),
    entityId: v.string(),
});
