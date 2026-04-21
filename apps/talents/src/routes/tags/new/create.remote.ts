import { form } from '$app/server';
import { db } from '$lib/server/db';
import { tag } from '@ac/db';
import { getAuthenticatedUser } from '$lib/server/authorization';
import * as v from 'valibot';
import { listTags } from '../list.remote';
import { readTag } from '../[id]/read.remote';

const createTagSchema = v.object({
    name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
});

export const createTag = form(createTagSchema, async (input) => {
    const user = getAuthenticatedUser();

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

    readTag(newTag.id).set(newTag);
    void listTags().refresh();
    return { success: true, ...newTag };
});
