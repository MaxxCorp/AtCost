import * as v from 'valibot';
import type { Event as DbEvent } from '@ac/db';
import type { Tag } from './tags.js';

/**
 * Event interface matching the database schema, with dates serialized to strings
 */
export type ResolvedEventContact = {
	id?: string | null;
	name: string;
	email: string;
	phone: string;
	isPublic?: boolean;
	role?: string | null;
	roles?: string[] | null;
	qrCodeDataUrl?: string;
	qrCodePath?: string;
};

export type Event = Omit<DbEvent, 'createdAt' | 'updatedAt' | 'startDateTime' | 'endDateTime' | 'signUpClosureDate'> & {
	createdAt: string;
	updatedAt: string;
	startDateTime: string | null;
	endDateTime: string | null;
	signUpClosureDate: string | null;
	resourceIds?: string[];
	contactIds?: string[];
	locationIds?: string[];
	locations?: {
		id: string;
		name: string;
		roomId?: string | null;
		street: string | null;
		houseNumber: string | null;
		zip: string | null;
		city: string | null;
		country: string | null;
		isPublic: boolean;
	}[];
	resources?: {
		id: string;
		name: string;
		type: string;
		description?: string | null;
	}[];
	rooms?: string[];
	tags?: Tag[];
	contacts?: any[];
	syncIds?: string[];
	participationStatuses?: Record<string, string>;
	maxOccupancy?: number | null;
	resolvedContact?: ResolvedEventContact | null;
	signUpContact?: any | null;
	resolvedSignUpContact?: ResolvedEventContact | null;
	qrCodePath?: string | null;
	iCalPath?: string | null;
	isSeries?: boolean;
	instanceCount?: number;
	instances?: Event[];
	prices?: any[];
	priceIds?: string[];
	priceLists?: any[];
	priceListIds?: string[];
};


import { FilterableIdSchema } from './pagination.js';

export type EventSignUpMode = 'off' | 'recommended' | 'required';

export const eventSignUpSchema = v.pipe(
	v.object({
		eventId: v.pipe(v.string(), v.minLength(1)),
		givenName: v.pipe(v.string(), v.trim(), v.minLength(1, 'First name is required')),
		familyName: v.pipe(v.string(), v.trim(), v.minLength(1, 'Last name is required')),
		emails: v.optional(
			v.array(
				v.union([
					v.pipe(v.string(), v.trim(), v.email('Please enter a valid email address')),
					v.pipe(v.string(), v.trim(), v.length(0))
				])
			),
			[]
		),
		phones: v.optional(v.array(v.pipe(v.string(), v.trim())), []),
		partySize: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
		notifyOnChanges: v.optional(v.boolean(), false),
		subscribeLocationNewsletter: v.optional(v.boolean(), false),
		existingContactId: v.optional(v.pipe(v.string(), v.uuid())),
	}),
	v.check((input) => {
		if (input.notifyOnChanges || input.subscribeLocationNewsletter) {
			return (input.emails ?? []).some((e) => e.trim().length > 0);
		}
		return true;
	}, 'A valid email address is required to receive event updates or location newsletters.')
);

export const lookupEventReservationSchema = v.pipe(
	v.object({
		eventId: v.pipe(v.string(), v.minLength(1)),
		email: v.optional(
			v.union([
				v.pipe(v.string(), v.trim(), v.email('Please enter a valid email address')),
				v.pipe(v.string(), v.trim(), v.length(0))
			])
		),
		phone: v.optional(v.pipe(v.string(), v.trim())),
	}),
	v.check((input) => {
		const hasEmail = Boolean(input.email && input.email.trim().length > 0);
		const hasPhone = Boolean(input.phone && input.phone.replace(/\D/g, '').length >= 6);
		return hasEmail || hasPhone;
	}, 'Please enter an email address or a phone number (at least 6 digits) to look up your reservation.')
);

export const cancelEventReservationSchema = v.pipe(
	v.object({
		eventId: v.pipe(v.string(), v.minLength(1)),
		contactId: v.pipe(v.string(), v.uuid()),
		email: v.optional(v.string()),
		phone: v.optional(v.string()),
	}),
	v.check((input) => {
		const hasEmail = Boolean(input.email && input.email.trim().length > 0);
		const hasPhone = Boolean(input.phone && input.phone.replace(/\D/g, '').length >= 6);
		return hasEmail || hasPhone;
	}, 'Verification email or phone number is required.')
);

export const eventPaginationSchema = v.optional(v.object({
	page: v.optional(v.number(), 1),
	limit: v.optional(v.number(), 50),
	search: v.optional(v.string()),
	locationId: FilterableIdSchema,
	tagId: FilterableIdSchema,
	contactId: FilterableIdSchema,
	sortField: v.optional(v.union([v.literal('updatedAt'), v.literal('startDateTime'), v.literal('createdAt')])),
	sortOrder: v.optional(v.union([v.literal('asc'), v.literal('desc')])),
	grouped: v.optional(v.boolean(), false),
	seriesId: v.optional(v.string()),
    excludeTentative: v.optional(v.boolean()),
    excludeCancelled: v.optional(v.boolean()),
    excludeNonPublic: v.optional(v.boolean()),
    excludePast: v.optional(v.boolean()),
    excludeSeries: v.optional(v.boolean()),
    onlySeries: v.optional(v.boolean()),
    includeSeriesEntries: v.optional(v.boolean()),
    excludedEventIds: v.optional(v.array(v.string())),
    includedEventIds: v.optional(v.array(v.string())),
    excludedTags: v.optional(v.array(v.string())),
    includedTags: v.optional(v.array(v.string())),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
}), {});
