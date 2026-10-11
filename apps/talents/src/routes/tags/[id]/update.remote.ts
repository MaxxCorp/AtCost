import { form, requested } from '$app/server';
import { db, tag, eq } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { updateTagSchema } from '@ac/validations';
import { readTag } from './read.remote.js';
import { listTags } from '../list.remote.js';

export const updateTag = form(updateTagSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'tags');

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

    void readTag(updatedTag.id).refresh();
    try {
        await requested(listTags, 20).refreshAll();
    } catch { /* ignore */ }
    void listTags().refresh();
    void listTags({}).refresh();

    return { success: true, tag: updatedTag, ...updatedTag };
});
