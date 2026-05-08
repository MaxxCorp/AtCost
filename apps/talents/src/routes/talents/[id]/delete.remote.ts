import { command } from '$app/server';
import { db, talent, eq } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';

import { listTalents } from '../list.remote';

export const deleteTalent = command(v.string(), async (id): Promise<{ success: boolean }> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    await db.delete(talent).where(eq(talent.id, id));
    void listTalents().refresh();
    return { success: true };
});
