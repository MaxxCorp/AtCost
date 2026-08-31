import * as v from 'valibot';
import { PaginationBaseSchema, FilterableIdSchema } from './pagination.js';

export const TimeOffPaginationSchema = v.intersect([
    PaginationBaseSchema,
    v.object({
        talentId: FilterableIdSchema,
        type: FilterableIdSchema,
        status: FilterableIdSchema,
    })
]);

export type TimeOff = {
    id: string;
    talentId: string;
    type: string;
    start: string;
    end: string;
    note?: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
};
