import { command } from '$app/server';
import { db, eventRole, eq } from '@ac/db';
import { getAuthenticatedUser } from '#lib/server/authorization.js';
import * as v from 'valibot';
import { listEventRoles } from '../list.remote.js';

export const deleteEventRole = command(v.object({ id: v.string() }), async ({ id }) => {
    const user = getAuthenticatedUser();
    if (!user) throw new Error('Unauthorized');

    await db.delete(eventRole).where(eq(eventRole.id, id));
    void listEventRoles({}).refresh();
    return { success: true };
});
