import * as v from 'valibot';

export const readCmsSchema = v.object({
    branch: v.optional(v.string(), 'published'),
    language: v.optional(v.string()),
    pageSlug: v.optional(v.string()),
    slotName: v.optional(v.string()),
});

export const updateCmsSchema = v.object({
    content: v.string(),
    language: v.optional(v.string(), 'en'),
    branch: v.optional(v.string(), 'published'),
    pageSlug: v.optional(v.string()),
    slotName: v.optional(v.string()),
});

export const createBlockSchema = v.object({
    name: v.string(),
    description: v.optional(v.string()),
});

export const linkBlockSchema = v.object({
    blockId: v.pipe(v.string(), v.uuid()),
    pageSlug: v.optional(v.string()),
    slotName: v.optional(v.string()),
});

export const deleteBlockSchema = v.pipe(v.string(), v.uuid());
export const getBlockSchema = v.pipe(v.string(), v.uuid());

export const renameBlockSchema = v.object({
    blockId: v.pipe(v.string(), v.uuid()),
    newName: v.pipe(v.string(), v.minLength(1)),
});
