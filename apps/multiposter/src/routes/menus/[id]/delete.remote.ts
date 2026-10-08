import { command, requested } from '$app/server';
import { db, menu, inArray } from '@ac/db';
import { listMenus } from '../list.remote';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import * as v from 'valibot';

export const deleteMenus = command(v.array(v.string()), async (ids: string[]) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'menus');

    await db
        .delete(menu)
        .where(inArray(menu.id, ids));

    try {
        await requested(listMenus, 10).refreshAll();
    } catch (e) {
        console.warn('[deleteMenus] requested refresh warning:', e);
    }
    try {
        await listMenus().refresh();
    } catch (e) {
        console.warn('[deleteMenus] listMenus().refresh() warning:', e);
    }
    return { success: true };
});
