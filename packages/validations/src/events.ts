import * as v from 'valibot';
import type { Event as DbEvent } from '@ac/db';
import type { Tag } from './tags.js';

/**
 * Event interface matching the database schema, with dates serialized to strings
 */
export type Event = Omit<DbEvent, 'createdAt' | 'updatedAt' | 'startDateTime' | 'endDateTime'> & {
	createdAt: string;
	updatedAt: string;
	startDateTime: string | null;
	endDateTime: string | null;
	resourceIds?: string[];
	contactIds?: string[];
	locationIds?: string[];
	locations?: {
		id: string;
		name: string;
		street: string | null;
		houseNumber: string | null;
		zip: string | null;
		city: string | null;
		country: string | null;
		isPublic: boolean;
	}[];
	tags?: Tag[];
	syncIds?: string[];
	participationStatuses?: Record<string, string>;
	maxOccupancy?: number | null;
	resolvedContact?: {
		name: string;
		email: string;
		phone: string;
		qrCodeDataUrl?: string;
	} | null;
	qrCodePath?: string | null;
	iCalPath?: string | null;
};

export type PublicEvent = Omit<Event, 'resolvedContact'> & {
    resolvedContact: {
        name: string;
        company?: string | null;
        role?: string | null;
        department?: string | null;
        emails: { value: string; type: string | null; primary: boolean }[];
        phones: { value: string; type: string | null; primary: boolean }[];
        address: {
            street: string | null;
            houseNumber: string | null;
            zip: string | null;
            city: string | null;
            country: string | null;
        } | null;
        qrCodeDataUrl?: string;
        qrCodePath?: string;
    } | null;
    ticketPrice?: string | null;
    categoryBerlinDotDe?: string | null;
    qrCodeDataUrl?: string;
    confirmedParticipants?: number;
    maxOccupancy?: number | null;
    inclusivityInformation?: string[];
    roomTitle?: string | null;
    tags?: Tag[];
    locationIds?: string[];
    locations?: {
        id: string;
        name: string;
        street: string | null;
        houseNumber: string | null;
        zip: string | null;
        city: string | null;
        country: string | null;
        isPublic: boolean;
    }[];
};


import { FilterableIdSchema } from './pagination.js';

export const eventPaginationSchema = v.optional(v.object({
	page: v.optional(v.number(), 1),
	limit: v.optional(v.number(), 50),
	search: v.optional(v.string()),
	locationId: FilterableIdSchema,
	tagId: FilterableIdSchema,
	contactId: FilterableIdSchema,
}), {});
