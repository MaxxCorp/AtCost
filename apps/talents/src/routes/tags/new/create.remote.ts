import { form, requested } from '$app/server';
import { db, tag, eq } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { createTagSchema } from '@ac/validations';
import { listTags } from '../list.remote.js';
import { readTag } from '../[id]/read.remote.js';

export const createTag = form(createTagSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    // Check if tag already exists
    const existing = await db.query.tag.findFirst({
        where: eq(tag.name, input.name)
    });

    if (existing) {
        return { success: true, ...existing };
    }

    const [newTag] = await db.insert(tag).values({
        name: input.name,
        visibility: input.visibility || 'internal',
        categoryId: input.categoryId || null,
        color: input.color || 'indigo',
        description: input.description || null,
        userId: user.id
    }).returning();

    void readTag(newTag.id).refresh();
    try {
        await requested(listTags, 20).refreshAll();
    } catch { /* ignore */ }
    void listTags().refresh();
    void listTags({}).refresh();

    return { success: true, ...newTag };
});
