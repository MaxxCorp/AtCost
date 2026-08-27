import * as v from 'valibot';

export const PaginationBaseSchema = v.object({
    page: v.optional(v.number(), 1),
    limit: v.optional(v.number(), 50),
    search: v.optional(v.string()),
    associatedWith: v.optional(v.object({
        type: v.string(),
        id: v.string()
    })),
    sortField: v.optional(v.string()),
    sortOrder: v.optional(v.union([v.literal('asc'), v.literal('desc')])),
});

export const PaginationSchema = v.optional(PaginationBaseSchema, {});

export const FilterValueObjectSchema = v.object({
    include: v.optional(v.union([v.string(), v.array(v.string())])),
    exclude: v.optional(v.union([v.string(), v.array(v.string())])),
    in: v.optional(v.union([v.string(), v.array(v.string())])),
    notIn: v.optional(v.union([v.string(), v.array(v.string())])),
});

export const FilterableValueSchema = v.union([
    v.string(),
    v.array(v.string()),
    FilterValueObjectSchema,
]);

export const FilterableIdSchema = v.optional(FilterableValueSchema);

export type FilterValue = v.InferOutput<typeof FilterableValueSchema>;

export interface FilterCriteria {
    include: string[];
    exclude: string[];
}

/**
 * Parses any incoming filter value representation (string, string[], or { include, exclude } / { in, notIn })
 * into a standardized { include: string[], exclude: string[] } object.
 */
export function parseFilterValue(val: any): FilterCriteria {
    if (!val) {
        return { include: [], exclude: [] };
    }
    if (typeof val === 'string') {
        const trimmed = val.trim();
        return { include: trimmed ? [trimmed] : [], exclude: [] };
    }
    if (Array.isArray(val)) {
        return {
            include: val.filter((item): item is string => typeof item === 'string' && item.trim().length > 0),
            exclude: [],
        };
    }
    if (typeof val === 'object') {
        const inc = val.include ?? val.in;
        const exc = val.exclude ?? val.notIn;

        const parseList = (target: any): string[] => {
            if (!target) return [];
            if (typeof target === 'string') {
                const trimmed = target.trim();
                return trimmed ? [trimmed] : [];
            }
            if (Array.isArray(target)) {
                return target.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
            }
            return [];
        };

        return {
            include: parseList(inc),
            exclude: parseList(exc),
        };
    }
    return { include: [], exclude: [] };
}

export type PaginatedResult<T> = {
    data: T[];
    total: number;
};
