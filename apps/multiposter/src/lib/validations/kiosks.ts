import * as v from 'valibot';

// Helper to coerce string|number to number
const numberCoerce = v.pipe(
    v.union([v.string(), v.number()]),
    v.transform((input) => Number(input)),
    v.number('Must be a number')
);

export const createKioskSchema = v.object({
    name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
    description: v.optional(v.string()),
    locationIds: v.optional(v.union([v.array(v.string()), v.string()])), // Optional, if empty means all locations
    loopDuration: v.pipe(
        numberCoerce,
        v.minValue(3, 'Loop duration must be at least 3 seconds')
    ),
    lookAheadDays: v.optional(v.pipe(
        numberCoerce,
        v.minValue(0, 'Look ahead cannot be negative')
    ), 28),
    lookPastDays: v.optional(v.pipe(
        numberCoerce,
        v.minValue(0, 'Look past cannot be negative')
    ), 0),
    uiMode: v.optional(v.union([v.literal('carousel'), v.literal('table')])),
    rangeMode: v.optional(v.union([v.literal('rolling'), v.literal('fixed')])),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string())
});

export const updateKioskSchema = v.object({
    id: v.string(),
    name: v.optional(v.pipe(v.string(), v.minLength(1, 'Name is required'))),
    description: v.optional(v.string()), // Kept only one
    locationIds: v.optional(v.union([v.array(v.string()), v.string()])),
    loopDuration: v.optional(v.pipe(numberCoerce, v.minValue(3))),
    lookAheadDays: v.optional(v.pipe(numberCoerce, v.minValue(0))),
    lookPastDays: v.optional(v.pipe(numberCoerce, v.minValue(0))),
    uiMode: v.optional(v.union([v.literal('carousel'), v.literal('table')])),
    rangeMode: v.optional(v.union([v.literal('rolling'), v.literal('fixed')])),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string())
});

export type CreateKioskSchema = v.InferInput<typeof createKioskSchema>;
export type UpdateKioskSchema = v.InferInput<typeof updateKioskSchema>;
