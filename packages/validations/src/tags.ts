import * as v from 'valibot';
import { PaginationSchema, PaginationBaseSchema } from './pagination.js';

export const tagVisibilityPicklist = v.picklist(['internal', 'external']);
export type TagVisibility = v.InferOutput<typeof tagVisibilityPicklist>;

export const TagCategorySchema = v.object({
    id: v.pipe(v.string(), v.uuid()),
    name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string(), 'indigo'),
    icon: v.optional(v.string()),
    isDefault: v.optional(v.boolean(), false),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
});

export type TagCategory = v.InferOutput<typeof TagCategorySchema>;

export const createTagCategorySchema = v.object({
    name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string(), 'indigo'),
    icon: v.optional(v.string()),
    isDefault: v.optional(v.boolean(), false),
});

export type CreateTagCategoryInput = v.InferOutput<typeof createTagCategorySchema>;

export const updateTagCategorySchema = v.object({
    id: v.pipe(v.string(), v.uuid()),
    name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
});

export type UpdateTagCategoryInput = v.InferOutput<typeof updateTagCategorySchema>;

export const tagCategoryPaginationSchema = v.optional(
    v.object({
        ...PaginationBaseSchema.entries,
        search: v.optional(v.string()),
    }),
    {}
);

export const TagSchema = v.object({
    id: v.pipe(v.string(), v.uuid()),
    name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
    visibility: v.optional(tagVisibilityPicklist, 'internal'),
    categoryId: v.optional(v.string()),
    color: v.optional(v.string(), 'indigo'),
    description: v.optional(v.string()),
    userId: v.optional(v.string()),
    createdAt: v.optional(v.string()),
    user: v.optional(v.any()),
    category: v.optional(v.any()),
});

export type Tag = v.InferOutput<typeof TagSchema>;

export const tagPaginationSchema = v.optional(
    v.object({
        ...PaginationBaseSchema.entries,
        search: v.optional(v.string()),
        visibility: v.optional(tagVisibilityPicklist),
        categoryId: v.optional(v.string()),
    }),
    {}
);

export const createTagSchema = v.object({
    name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
    visibility: v.optional(tagVisibilityPicklist, 'internal'),
    categoryId: v.optional(v.string()),
    color: v.optional(v.string(), 'indigo'),
    description: v.optional(v.string()),
});

export const updateTagSchema = v.object({
    id: v.pipe(v.string(), v.uuid()),
    name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
    visibility: v.optional(tagVisibilityPicklist),
    categoryId: v.optional(v.string()),
    color: v.optional(v.string()),
    description: v.optional(v.string()),
});
