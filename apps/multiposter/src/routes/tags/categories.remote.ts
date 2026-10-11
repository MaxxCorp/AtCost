import { query, form, command, requested } from '$app/server';
import { db, tagCategory, eq } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import {
    tagCategoryPaginationSchema,
    createTagCategorySchema,
    updateTagCategorySchema,
} from '@ac/validations';
import * as v from 'valibot';
import {
    listCategories,
    createCategory,
    updateCategory,
    deleteCategory,
} from '#lib/server/tags/service.js';

export const listTagCategories = query(tagCategoryPaginationSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'events');

    return await listCategories(input);
});

export const readTagCategory = query(v.object({ id: v.string() }), async ({ id }) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'events');

    const cat = await db.query.tagCategory.findFirst({
        where: eq(tagCategory.id, id),
    });

    if (!cat) return null;

    return {
        ...cat,
        createdAt: cat.createdAt.toISOString(),
        updatedAt: cat.updatedAt.toISOString(),
    };
});

export const createTagCategoryAction = form(createTagCategorySchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'events');

    const created = await createCategory(input);

    try {
        await requested(listTagCategories, 20).refreshAll();
    } catch { /* ignore */ }
    void listTagCategories().refresh();
    void listTagCategories({}).refresh();

    return { success: true, category: created };
});

export const updateTagCategoryAction = form(updateTagCategorySchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'events');

    const updated = await updateCategory(input);

    try {
        await requested(listTagCategories, 20).refreshAll();
    } catch { /* ignore */ }
    void listTagCategories().refresh();
    void listTagCategories({}).refresh();
    void readTagCategory({ id: input.id }).refresh();

    return { success: true, category: updated };
});

export const deleteTagCategoryAction = command(
    v.union([
        v.object({ id: v.string() }),
        v.array(v.string())
    ]),
    async (input) => {
        const user = getAuthenticatedUser();
        ensureAccess(user, 'events');

        const ids = Array.isArray(input) ? input : [input.id];
        for (const id of ids) {
            await deleteCategory(id);
        }

        try {
            await requested(listTagCategories, 20).refreshAll();
        } catch { /* ignore */ }
        void listTagCategories().refresh();
        void listTagCategories({}).refresh();

        return { success: true };
    }
);
