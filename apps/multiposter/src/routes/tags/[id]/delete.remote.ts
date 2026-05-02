import { command } from '$app/server';
import { db } from '@ac/db';
import { tag } from '@ac/db';
import { eq, and, inArray } from 'drizzle-orm';
import { getAuthenticatedUser } from '$lib/server/authorization';
import * as v from 'valibot';
import { listTags } from '../list.remote';

const deleteTagSchema = v.array(v.pipe(v.string(), v.uuid()));

export const deleteTag = command(deleteTagSchema, async (ids) => {

    await db.delete(tag)
        .where(inArray(tag.id, ids));

    void listTags().refresh();
    return { success: true };
});
