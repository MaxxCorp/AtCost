import * as v from 'valibot';
import { FilterableIdSchema } from './pagination.js';
import type { Kiosk as DbKiosk } from '@ac/db';

export type Kiosk = Omit<DbKiosk, 'createdAt' | 'updatedAt' | 'startDate' | 'endDate'> & {
    createdAt: string;
    updatedAt: string;
    startDate: string | null;
    endDate: string | null;
    publicContactQrCodePath?: string | null;
    locations?: { id: string, name: string, publicContactQrCodePath: string | null }[];
    user?: {
		id: string;
		name: string | null;
		email: string;
	};
};

export const kioskPaginationSchema = v.optional(v.object({
	page: v.optional(v.number(), 1),
	limit: v.optional(v.number(), 50),
	search: v.optional(v.string()),
	locationId: FilterableIdSchema,
	sortField: v.optional(v.picklist(['updatedAt', 'createdAt', 'name']), 'updatedAt'),
	sortOrder: v.optional(v.picklist(['asc', 'desc']), 'desc'),
    _t: v.optional(v.number()),
}), {});
