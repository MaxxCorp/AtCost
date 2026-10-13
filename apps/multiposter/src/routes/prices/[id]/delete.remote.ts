import { command, requested } from '$app/server';
import { db, price, inArray } from '@ac/db';
import { listPrices } from '../list.remote';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import * as v from 'valibot';

export const deletePrices = command(v.array(v.string()), async (ids: string[]) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'prices');

    await db
        .delete(price)
        .where(inArray(price.id, ids));

    try {
        await requested(listPrices, 10).refreshAll();
    } catch (e) {
        console.warn('[deletePrices] requested refresh warning:', e);
    }
    try {
        await listPrices().refresh();
    } catch (e) {
        console.warn('[deletePrices] listPrices().refresh() warning:', e);
    }
    return { success: true };
});
