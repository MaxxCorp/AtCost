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
