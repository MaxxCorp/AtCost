import * as v from 'valibot';
import { FilterableIdSchema } from './pagination.js';
import type { Resource as DbResource } from '@ac/db';

export type Resource = Omit<DbResource, 'createdAt' | 'updatedAt'> & {
    locationName: string | null;
    createdAt: string;
    updatedAt: string;
};

export const resourcePaginationSchema = v.optional(v.object({
	page: v.optional(v.number(), 1),
	limit: v.optional(v.number(), 50),
	search: v.optional(v.string()),
	locationId: FilterableIdSchema,
    associatedWith: v.optional(v.object({
        type: v.string(),
        id: v.string()
    }))
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
