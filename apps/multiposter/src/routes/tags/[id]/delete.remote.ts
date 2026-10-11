import { command, requested } from '$app/server';
import { db } from '@ac/db';
import { tag } from '@ac/db';
import { eq, and, inArray } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import * as v from 'valibot';
import { listTags } from '../list.remote';

const deleteTagSchema = v.array(v.pipe(v.string(), v.uuid()));

export const deleteTag = command(deleteTagSchema, async (ids) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'tags');

    await db.delete(tag)
        .where(inArray(tag.id, ids));

    try {
        await requested(listTags, 20).refreshAll();
    } catch { /* ignore */ }
    void listTags().refresh();
    void listTags({ limit: 50 }).refresh();
    return { success: true };
});
