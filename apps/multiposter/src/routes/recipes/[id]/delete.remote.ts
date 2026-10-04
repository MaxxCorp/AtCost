import { command } from '$app/server';
import { db, recipe, inArray } from '@ac/db';
import { listRecipes } from '../list.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';

export const deleteRecipes = command(v.array(v.string()), async (ids: string[]) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'recipes');

    await db
        .delete(recipe)
        .where(inArray(recipe.id, ids));

    await listRecipes().refresh();
    return { success: true };
});
