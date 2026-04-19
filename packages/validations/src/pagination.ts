import * as v from 'valibot';

export const PaginationBaseSchema = v.object({
    page: v.optional(v.number(), 1),
    limit: v.optional(v.number(), 50),
    search: v.optional(v.string())
});

export const PaginationSchema = v.optional(PaginationBaseSchema, {});


export const FilterableIdSchema = v.optional(v.union([v.string(), v.array(v.string())]));

export type PaginatedResult<T> = {
    data: T[];
    total: number;
};
