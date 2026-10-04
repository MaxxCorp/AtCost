import { command } from '$app/server';
import { db, menu, inArray } from '@ac/db';
import { listMenus } from '../list.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';

export const deleteMenus = command(v.array(v.string()), async (ids: string[]) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'menus');

    await db
        .delete(menu)
        .where(inArray(menu.id, ids));

    await listMenus().refresh();
    return { success: true };
});
