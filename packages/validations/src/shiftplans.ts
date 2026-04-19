import * as v from 'valibot';

export const createShiftplanSchema = v.object({
    name: v.pipe(v.string(), v.minLength(1, "Name is required")),
    locationId: v.optional(v.string()),
    schedule: v.optional(v.string()), // A stringified JSON configuration of days
});

export const updateShiftplanSchema = v.object({
    id: v.string(),
    name: v.pipe(v.string(), v.minLength(1, "Name is required")),
    locationId: v.optional(v.string()),
    schedule: v.optional(v.string()),
});
import { FilterableIdSchema } from './pagination.js';

export const ShiftplanPaginationSchema = v.optional(v.object({
    page: v.optional(v.number(), 1),
    limit: v.optional(v.number(), 50),
    search: v.optional(v.string()),
    locationId: FilterableIdSchema,
}), {});

export interface ShiftplanOverview {
    id: string;
    name: string;
    schedule: any;
    createdAt: string;
    locationName: string | null;
}
