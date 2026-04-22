import * as v from 'valibot';
import { PaginationSchema } from './pagination.js';

export const TagSchema = v.object({
    id: v.pipe(v.string(), v.uuid()),
    name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
    userId: v.optional(v.string()),
    createdAt: v.optional(v.string()),
});

export type Tag = v.InferOutput<typeof TagSchema>;

export const tagPaginationSchema = v.intersect([
    PaginationSchema,
    v.object({
        search: v.optional(v.string()),
    })
]);
