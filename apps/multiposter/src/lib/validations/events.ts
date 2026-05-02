import * as v from 'valibot';
import * as m from '$lib/paraglide/messages';

const recurrenceSchema = v.union([v.array(v.string()), v.string()]);

const attendeesSchema = v.array(v.object({
	id: v.optional(v.string()),
	email: v.pipe(v.string(), v.email()),
	displayName: v.optional(v.string()),
	optional: v.optional(v.boolean()),
	responseStatus: v.optional(v.string()),
	organizer: v.optional(v.boolean()),
	self: v.optional(v.boolean()),
	resource: v.optional(v.boolean()),
	comment: v.optional(v.string()),
	additionalGuests: v.optional(v.number()),
}));

const remindersSchema = v.object({
	useDefault: v.union([v.boolean(), v.string()]),
	overrides: v.optional(v.array(v.object({
		method: v.string(),
		minutes: v.number()
	})))
});

const arrayStringSchema = v.pipe(
	v.any(),
	v.transform((val: any) => {
		if (Array.isArray(val)) return val;
		if (typeof val === 'string' && val) return [val];
		return [];
	}),
	v.array(v.string())
);

const booleanSchema = v.pipe(
	v.any(),
	v.transform((val: any) => {
		if (typeof val === 'boolean') return val;
		if (val === 'true' || val === 'on') return true;
		if (val === 'false') return false;
		return false;
	}),
	v.boolean()
);

/**
 * Shared Valibot schema for event creation and updates
 * Using string for start/end to be compatible with RemoteFormInput (SvelteKit)
 */
export const eventBaseSchema = v.object({
	summary: v.pipe(v.string(), v.minLength(1, 'Event title is required')),
	description: v.optional(v.string()),
	location: v.optional(v.string()),
	locationIds: v.optional(arrayStringSchema, []),
	// RemoteFormInput only allows string | number | boolean | File | ...
	// So we use string and parse to Date manually where needed.
	isAllDay: v.optional(booleanSchema, false),
	startDate: v.pipe(v.string(), v.minLength(1, 'Start date is required')),
	startTime: v.optional(v.string()),
	startTimeZone: v.optional(v.string()),
	endDate: v.optional(v.string()),
	endTime: v.optional(v.string()),
	endTimeZone: v.optional(v.string()),
	recurrence: v.optional(v.union([v.array(v.string()), v.string()])),
	attendees: v.optional(attendeesSchema),
	reminders: v.optional(remindersSchema),
	remindersJson: v.optional(v.string()),
	isPublic: v.optional(booleanSchema, true),
	guestsCanInviteOthers: v.optional(booleanSchema, true),
	guestsCanModify: v.optional(booleanSchema, false),
	guestsCanSeeOtherGuests: v.optional(booleanSchema, true),
	resourceIds: v.optional(arrayStringSchema, []),
	contactIds: v.optional(arrayStringSchema, []),
	categoryBerlinDotDe: v.optional(v.string()),
	ticketPrice: v.optional(v.string()), 
	tagIds: v.optional(arrayStringSchema, []),
	syncIds: v.optional(arrayStringSchema, []),
	status: v.optional(v.string()),
	heroImage: v.optional(v.string()),
});

export const createEventSchema = eventBaseSchema;

export const updateEventSchema = v.object({
    ...v.partial(eventBaseSchema).entries,
    id: v.pipe(v.string(), v.uuid())
});

export const deleteEventSchema = v.object({
    id: v.pipe(v.string(), v.uuid()),
    deleteAllInSeries: v.optional(v.boolean(), false)
});

export const listEventsSchema = v.optional(v.object({
    page: v.optional(v.number(), 1),
    limit: v.optional(v.number(), 50),
    search: v.optional(v.string()),
    locationId: v.optional(v.union([v.string(), v.array(v.string())])),
    tagId: v.optional(v.union([v.string(), v.array(v.string())])),
    contactId: v.optional(v.union([v.string(), v.array(v.string())])),
}), {});
