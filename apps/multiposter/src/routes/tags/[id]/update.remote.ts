import { form } from '$app/server';
import { db } from '$lib/server/db';
import { tag } from '@ac/db';
import { eq, and } from 'drizzle-orm';
import { ensureAccess, getAuthenticatedUser } from '$lib/server/authorization';
import * as v from 'valibot';
import { listTags } from '../list.remote';

const updateTagSchema = v.object({
    id: v.pipe(v.string(), v.uuid()),
    name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
});

export const updateTag = form(updateTagSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, "events");

    const [updatedTag] = await db.update(tag)
        .set({ name: input.name })
        .where(eq(tag.id, input.id))
        .returning();

    void listTags().refresh();
    return { success: true, ...updatedTag };
});
