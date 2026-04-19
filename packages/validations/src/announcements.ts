import * as v from 'valibot';
import type { Announcement as DbAnnouncement } from '@ac/db';

/**
 * Announcement interface matching the database schema, with dates serialized to strings
 */
export type Announcement = Omit<DbAnnouncement, 'createdAt' | 'updatedAt'> & {
    createdAt: string;
    updatedAt: string;
    tagIds?: string[];
    tagNames?: string[];
    syncIds?: string[];
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
    resolvedContact?: {
        name: string;
        email: string;
        phone: string;
        qrCodeDataUrl?: string;
        qrCodePath?: string;
    } | null;
};

import { FilterableIdSchema } from './pagination.js';

export const announcementPaginationSchema = v.optional(v.object({
	page: v.optional(v.number(), 1),
	limit: v.optional(v.number(), 50),
	search: v.optional(v.string()),
	locationId: FilterableIdSchema,
}), {});
