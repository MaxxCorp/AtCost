import { command, requested } from '$app/server';
import { db, consumable, inArray } from '@ac/db';
import { listConsumables } from '../list.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';

export const deleteConsumables = command(v.array(v.string()), async (ids: string[]) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'consumables');

    await db
        .delete(consumable)
        .where(inArray(consumable.id, ids));

    try {
        await requested(listConsumables, 10).refreshAll();
    } catch (e) {
        console.warn('[deleteConsumables] requested refresh warning:', e);
    }
    try {
        await listConsumables().refresh();
    } catch (e) {
        console.warn('[deleteConsumables] listConsumables().refresh() warning:', e);
    }
    return { success: true };
});
