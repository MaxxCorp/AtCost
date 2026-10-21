import * as v from 'valibot';
import type {
    Location as DbLocation,
    DayOfWeek,
    OpeningTimeSlot,
    DaySchedule,
    SpecialDaySchedule,
    SeasonalSchedule,
    OpeningHoursData,
} from '@ac/db';

export type {
    DayOfWeek,
    OpeningTimeSlot,
    DaySchedule,
    SpecialDaySchedule,
    SeasonalSchedule,
    OpeningHoursData,
};

export const dayOfWeekPicklist = v.picklist([
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
]);

export const openingTimeSlotSchema = v.object({
    open: v.string(),
    close: v.string(),
    label: v.optional(v.string()),
});

export const dayScheduleSchema = v.object({
    closed: v.optional(v.boolean(), false),
    slots: v.optional(v.array(openingTimeSlotSchema), []),
    note: v.optional(v.string()),
});

export const specialDayScheduleSchema = v.object({
    date: v.string(),
    closed: v.optional(v.boolean(), true),
    slots: v.optional(v.array(openingTimeSlotSchema)),
    note: v.optional(v.string()),
});

export const seasonalScheduleSchema = v.object({
    name: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    days: v.optional(v.record(dayOfWeekPicklist, dayScheduleSchema)),
});

export const openingHoursDataSchema = v.object({
    days: v.optional(v.record(dayOfWeekPicklist, dayScheduleSchema)),
    specialHours: v.optional(v.array(specialDayScheduleSchema)),
    seasonalHours: v.optional(v.array(seasonalScheduleSchema)),
    notes: v.optional(v.string()),
    raw: v.optional(v.string()),
});

export const openingHoursFieldSchema = v.optional(
    v.union([
        openingHoursDataSchema,
        v.pipe(
            v.string(),
            v.transform((val) => {
                if (!val || val.trim() === '') return undefined;
                try {
                    const parsed = JSON.parse(val);
                    if (typeof parsed === 'object' && parsed !== null) {
                        return parsed as OpeningHoursData;
                    }
                    return { raw: val };
                } catch {
                    return { raw: val };
                }
            })
        ),
        v.null(),
    ])
);

const DAY_ORDER: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS_DE: Record<DayOfWeek, string> = {
    monday: 'Mo',
    tuesday: 'Di',
    wednesday: 'Mi',
    thursday: 'Do',
    friday: 'Fr',
    saturday: 'Sa',
    sunday: 'So',
};

export function formatOpeningHours(data: OpeningHoursData | string | null | undefined): string {
    if (!data) return '';
    if (typeof data === 'string') {
        const trimmed = data.trim();
        if (trimmed.startsWith('{')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (typeof parsed === 'object' && parsed !== null) {
                    return formatOpeningHours(parsed as OpeningHoursData);
                }
            } catch {
                // fall through
            }
        }
        return data;
    }

    if (data.raw && (!data.days || Object.keys(data.days).length === 0)) {
        return data.raw;
    }

    const lines: string[] = [];

    if (data.days && Object.keys(data.days).length > 0) {
        interface DayFormatted {
            day: DayOfWeek;
            text: string;
            isClosed: boolean;
        }

        const formattedDays: DayFormatted[] = DAY_ORDER.map((day) => {
            const sched = data.days?.[day];
            if (!sched || sched.closed || !sched.slots || sched.slots.length === 0) {
                return { day, text: 'Geschlossen', isClosed: true };
            }
            const slotsText = sched.slots
                .map((s) => `${s.open}–${s.close} Uhr${s.label ? ` (${s.label})` : ''}`)
                .join(', ');
            const noteText = sched.note ? ` (${sched.note})` : '';
            return { day, text: `${slotsText}${noteText}`, isClosed: false };
        });

        let groupStart = 0;
        while (groupStart < formattedDays.length) {
            let groupEnd = groupStart;
            while (
                groupEnd + 1 < formattedDays.length &&
                formattedDays[groupEnd + 1].text === formattedDays[groupStart].text
            ) {
                groupEnd++;
            }

            const current = formattedDays[groupStart];
            if (!current.isClosed) {
                let dayRange = '';
                if (groupStart === groupEnd) {
                    dayRange = DAY_LABELS_DE[formattedDays[groupStart].day];
                } else if (groupEnd === groupStart + 1) {
                    dayRange = `${DAY_LABELS_DE[formattedDays[groupStart].day]}, ${DAY_LABELS_DE[formattedDays[groupEnd].day]}`;
                } else {
                    dayRange = `${DAY_LABELS_DE[formattedDays[groupStart].day]}–${DAY_LABELS_DE[formattedDays[groupEnd].day]}`;
                }
                lines.push(`${dayRange} ${current.text}`);
            }

            groupStart = groupEnd + 1;
        }
    }

    if (data.specialHours && data.specialHours.length > 0) {
        for (const spec of data.specialHours) {
            if (spec.closed) {
                lines.push(`Ausnahme ${spec.date}: Geschlossen${spec.note ? ` (${spec.note})` : ''}`);
            } else if (spec.slots && spec.slots.length > 0) {
                const sText = spec.slots.map((s) => `${s.open}–${s.close} Uhr`).join(', ');
                lines.push(`Ausnahme ${spec.date}: ${sText}${spec.note ? ` (${spec.note})` : ''}`);
            }
        }
    }

    if (data.notes && data.notes.trim()) {
        lines.push(data.notes.trim());
    }

    if (lines.length === 0 && data.raw) {
        return data.raw;
    }

    return lines.join('\n');
}

export const locationBaseSchema = v.object({
    name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
    description: v.optional(v.string()),
    capacity: v.optional(v.string()),
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
    openingHours: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    heroImage: v.optional(v.string()),
});

/**
 * Location interface matching the database schema, with dates serialized to strings
 */
export type Location = Omit<DbLocation, 'createdAt' | 'updatedAt'> & {
	createdAt: string;
	updatedAt: string;
	user?: {
		id: string;
		name: string | null;
		email: string;
	};
};

export const createLocationSchema = locationBaseSchema;
export const updateLocationSchema = v.intersect([
    locationBaseSchema,
    v.object({ id: v.pipe(v.string(), v.uuid()) })
]);

import { FilterableIdSchema } from './pagination.js';

export const LocationPaginationSchema = v.optional(v.object({
    page: v.optional(v.number(), 1),
    limit: v.optional(v.number(), 50),
    search: v.optional(v.string()),
    city: FilterableIdSchema,
    associatedWith: v.optional(v.object({
        type: v.string(),
        id: v.string()
    })),
    sortField: v.optional(v.union([v.literal('updatedAt'), v.literal('createdAt'), v.literal('name'), v.literal('displayName')])),
	sortOrder: v.optional(v.union([v.literal('asc'), v.literal('desc')])),
}), {});


export const locationAssociationSchema = v.object({
    type: v.picklist(['event', 'user', 'location', 'resource', 'announcement', 'kiosk', 'contact', 'talent']),
    entityId: v.string(),
    locationId: v.pipe(v.string(), v.uuid()),
});

export const getLocationAssociationsSchema = v.object({
    type: v.picklist(['event', 'user', 'location', 'resource', 'announcement', 'kiosk', 'contact', 'talent']),
    entityId: v.string(),
});
