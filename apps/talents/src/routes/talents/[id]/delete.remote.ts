import { command } from '$app/server';
import { db, talent, eq } from '$lib/server/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';

export const deleteTalent = command(v.string(), async (id): Promise<{ success: boolean }> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    await db.delete(talent).where(eq(talent.id, id));
    return { success: true };
});
