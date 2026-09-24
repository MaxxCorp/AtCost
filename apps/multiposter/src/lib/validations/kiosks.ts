import * as v from 'valibot';

// Helper to coerce string|number to number
const numberCoerce = v.pipe(
    v.union([v.string(), v.number()]),
    v.transform((input) => Number(input)),
    v.number('Must be a number')
);

const booleanCoerce = v.pipe(
    v.union([v.string(), v.boolean()]),
    v.transform((input) => input === 'true' || input === true),
    v.boolean()
);

const optionalDateString = v.optional(
    v.pipe(
        v.string(),
        v.check((val) => {
            if (!val || val.trim() === '') return true;
            const d = new Date(val);
            if (isNaN(d.getTime())) return false;
            const year = d.getFullYear();
            if (year < 1970 || year > 2100) return false;
            try {
                d.toISOString();
                return true;
            } catch {
                return false;
            }
        }, 'Must be a valid date between 1970 and 2100')
    )
);

export const createKioskSchema = v.object({
    name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
    description: v.optional(v.string()),
    locationIds: v.optional(v.union([v.array(v.string()), v.string()])), // Optional, if empty means all locations
    loopDuration: v.pipe(
        numberCoerce,
        v.minValue(3, 'Loop duration must be at least 3 seconds'),
        v.maxValue(86400, 'Loop duration cannot exceed 24 hours')
    ),
    lookAheadDays: v.optional(v.pipe(
        numberCoerce,
        v.minValue(0, 'Look ahead cannot be negative'),
        v.maxValue(3650, 'Look ahead cannot exceed 10 years')
    ), 28),
    lookPastDays: v.optional(v.pipe(
        numberCoerce,
        v.minValue(0, 'Look past cannot be negative'),
        v.maxValue(3650, 'Look past cannot exceed 10 years')
    ), 0),
    uiMode: v.optional(v.union([v.literal('carousel'), v.literal('table'), v.literal('flat_list'), v.literal('folded_flyer')])),
    rangeMode: v.optional(v.union([v.literal('rolling'), v.literal('fixed')])),
    startDate: optionalDateString,
    endDate: optionalDateString,
    excludeNonPublic: v.optional(booleanCoerce),
    excludeTentative: v.optional(booleanCoerce),
    excludeCancelled: v.optional(booleanCoerce),
    excludeSeries: v.optional(booleanCoerce),
    showEventQrCodes: v.optional(booleanCoerce),
    excludedEventIds: v.optional(v.union([v.array(v.string()), v.string()])),
    includedEventIds: v.optional(v.union([v.array(v.string()), v.string()])),
    excludedAnnouncementIds: v.optional(v.union([v.array(v.string()), v.string()])),
    includedAnnouncementIds: v.optional(v.union([v.array(v.string()), v.string()])),
    excludedTags: v.optional(v.union([v.array(v.string()), v.string()])),
    includedTags: v.optional(v.union([v.array(v.string()), v.string()]))
});

export const updateKioskSchema = v.object({
    id: v.string(),
    name: v.optional(v.pipe(v.string(), v.minLength(1, 'Name is required'))),
    description: v.optional(v.string()), // Kept only one
    locationIds: v.optional(v.union([v.array(v.string()), v.string()])),
    loopDuration: v.optional(v.pipe(
        numberCoerce,
        v.minValue(3, 'Loop duration must be at least 3 seconds'),
        v.maxValue(86400, 'Loop duration cannot exceed 24 hours')
    )),
    lookAheadDays: v.optional(v.pipe(
        numberCoerce,
        v.minValue(0, 'Look ahead cannot be negative'),
        v.maxValue(3650, 'Look ahead cannot exceed 10 years')
    )),
    lookPastDays: v.optional(v.pipe(
        numberCoerce,
        v.minValue(0, 'Look past cannot be negative'),
        v.maxValue(3650, 'Look past cannot exceed 10 years')
    )),
    uiMode: v.optional(v.union([v.literal('carousel'), v.literal('table'), v.literal('flat_list'), v.literal('folded_flyer')])),
    rangeMode: v.optional(v.union([v.literal('rolling'), v.literal('fixed')])),
    startDate: optionalDateString,
    endDate: optionalDateString,
    excludeNonPublic: v.optional(booleanCoerce),
    excludeTentative: v.optional(booleanCoerce),
    excludeCancelled: v.optional(booleanCoerce),
    excludeSeries: v.optional(booleanCoerce),
    showEventQrCodes: v.optional(booleanCoerce),
    excludedEventIds: v.optional(v.union([v.array(v.string()), v.string()])),
    includedEventIds: v.optional(v.union([v.array(v.string()), v.string()])),
    excludedAnnouncementIds: v.optional(v.union([v.array(v.string()), v.string()])),
    includedAnnouncementIds: v.optional(v.union([v.array(v.string()), v.string()])),
    excludedTags: v.optional(v.union([v.array(v.string()), v.string()])),
    includedTags: v.optional(v.union([v.array(v.string()), v.string()]))
});

export type CreateKioskSchema = v.InferInput<typeof createKioskSchema>;
export type UpdateKioskSchema = v.InferInput<typeof updateKioskSchema>;
