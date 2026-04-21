import { command } from '$app/server';
import { db } from '$lib/server/db';
import { tag } from '@ac/db';
import { eq, and, inArray } from 'drizzle-orm';
import { getAuthenticatedUser } from '$lib/server/authorization';
import * as v from 'valibot';
import { listTags } from '../list.remote';

const deleteTagSchema = v.array(v.pipe(v.string(), v.uuid()));

export const deleteTag = command(deleteTagSchema, async (ids) => {
    const user = getAuthenticatedUser();
    
    await db.delete(tag)
        .where(and(inArray(tag.id, ids), eq(tag.userId, user.id)));

    await (listTags as any).refresh();
    return { success: true };
});
