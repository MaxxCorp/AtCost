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
}), {});
