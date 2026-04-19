import * as v from 'valibot';
import type { Location as DbLocation } from '@ac/db';

export const locationBaseSchema = v.object({
    name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
    street: v.optional(v.string()),
    houseNumber: v.optional(v.string()),
    addressSuffix: v.optional(v.string()),
    zip: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    country: v.optional(v.string()),
    roomId: v.optional(v.string()),
    latitude: v.optional(v.string()),
    longitude: v.optional(v.string()),
    what3words: v.optional(v.string()),
    inclusivitySupport: v.optional(v.string()),
});

/**
 * Location interface matching the database schema, with dates serialized to strings
 */
export type Location = Omit<DbLocation, 'createdAt' | 'updatedAt'> & {
	createdAt: string;
	updatedAt: string;
};

export const createLocationSchema = locationBaseSchema;
export const updateLocationSchema = v.intersect([
    locationBaseSchema,
    v.object({ id: v.pipe(v.string(), v.uuid()) })
]);

export const LocationPaginationSchema = v.optional(v.object({
    page: v.optional(v.number(), 1),
    limit: v.optional(v.number(), 50),
    search: v.optional(v.string()),
    city: v.optional(v.union([v.string(), v.array(v.string())])),
}), {});
