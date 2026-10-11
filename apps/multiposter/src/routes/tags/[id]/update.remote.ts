import { form, requested } from '$app/server';
import { db, tag, eq } from '@ac/db';
import { ensureAccess, getAuthenticatedUser } from '#lib/server/authorization.js';
import { updateTagSchema } from '@ac/validations';
import { listTags } from '../list.remote.js';

export const updateTag = form(updateTagSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, "tags");

    const [updatedTag] = await db.update(tag)
        .set({
            name: input.name,
            visibility: input.visibility,
            categoryId: input.categoryId !== undefined ? (input.categoryId || null) : undefined,
            color: input.color,
            description: input.description,
        })
        .where(eq(tag.id, input.id))
        .returning();

    try {
        await requested(listTags, 20).refreshAll();
    } catch { /* ignore */ }
    void listTags().refresh();
    void listTags({ limit: 50 }).refresh();

    return { success: true, tag: updatedTag, ...updatedTag };
});
