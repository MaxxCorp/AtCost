import { form } from '$app/server';
import { db } from '@ac/db';
import { tag } from '@ac/db';
import { ensureAccess, getAuthenticatedUser } from '$lib/server/authorization';
import * as v from 'valibot';
import { listTags } from "../list.remote.js"

const createTagSchema = v.object({
    name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
});

export const createTag = form(createTagSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, "events");

    // Check if tag already exists for this user
    const existing = await db.query.tag.findFirst({
        where: (tags, { eq }) => eq(tags.name, input.name)
    });

    if (existing) {
        return existing;
    }

    const [newTag] = await db.insert(tag).values({
        name: input.name,
        userId: user.id
    }).returning();

    void listTags().refresh();
    return { success: true, tag: newTag };
});
