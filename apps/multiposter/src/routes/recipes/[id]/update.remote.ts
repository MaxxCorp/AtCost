import { form, requested } from '$app/server';
import { db, recipe, recipeConsumable, eq } from '@ac/db';
import { listRecipes } from '../list.remote';
import { readRecipe } from './read.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { updateRecipeSchema } from '@ac/validations';

export const updateRecipe = form(updateRecipeSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'recipes');

    const result = await db.transaction(async (tx) => {
        const [updatedRecipe] = await tx
            .update(recipe)
            .set({
                name: data.name,
                description: data.description || null,
                instructions: data.instructions || null,
                portions: data.portions || 1,
            })
            .where(eq(recipe.id, data.id))
            .returning();

        if (!updatedRecipe) {
            throw new Error('Recipe not found');
        }

        // Delete existing ingredients and re-insert
        await tx.delete(recipeConsumable).where(eq(recipeConsumable.recipeId, data.id));

        let ingredients: any[] = [];
        if (typeof data.ingredients === 'string') {
            try { ingredients = JSON.parse(data.ingredients); } catch { ingredients = []; }
        } else if (Array.isArray(data.ingredients)) {
            ingredients = data.ingredients;
        }

        if (ingredients.length > 0) {
            await tx.insert(recipeConsumable).values(
                ingredients.map((ing: any) => ({
                    recipeId: data.id,
                    consumableId: ing.consumableId,
                    amount: typeof ing.amount === 'number' ? ing.amount : parseFloat(String(ing.amount)) || 1,
                    unit: ing.unit || null,
                }))
            );
        }

        return updatedRecipe;
    });

    try {
        await requested(listRecipes, 20).refreshAll();
    } catch (e) {
        console.warn('--- updateRecipe requested refresh warning ---', e);
    }
    try {
        await listRecipes().refresh();
        await readRecipe(data.id).refresh();
    } catch (refreshErr) {
        console.warn('--- updateRecipe refresh warning ---', refreshErr);
    }

    return {
        success: true,
        recipe: {
            ...result,
            createdAt: result.createdAt.toISOString(),
            updatedAt: result.updatedAt.toISOString(),
        }
    };
});
