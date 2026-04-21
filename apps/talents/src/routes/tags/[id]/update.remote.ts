import { form } from '$app/server';
import { db } from '$lib/server/db';
import { tag } from '@ac/db';
import { eq, and } from 'drizzle-orm';
import { getAuthenticatedUser } from '$lib/server/authorization';
import * as v from 'valibot';
import { readTag } from '../[id]/read.remote';
import { listTags } from '../list.remote';

const updateTagSchema = v.object({
    id: v.pipe(v.string(), v.uuid()),
    name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
});

export const updateTag = form(updateTagSchema, async (input) => {
    const user = getAuthenticatedUser();

    const [updatedTag] = await db.update(tag)
        .set({ name: input.name })
        .where(eq(tag.id, input.id))
        .returning();

    readTag(updatedTag.id).set(updatedTag);
    void listTags().refresh();
    return { success: true, ...updatedTag };
});
