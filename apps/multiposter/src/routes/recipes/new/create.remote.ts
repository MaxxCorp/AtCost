import { form, requested } from '$app/server';
import { db, recipe, recipeConsumable } from '@ac/db';
import { listRecipes } from '../list.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { createRecipeSchema } from '@ac/validations';

export const createRecipe = form(createRecipeSchema, async (data) => {
    console.log('--- createRecipe START ---', JSON.stringify(data));
    try {
        const user = getAuthenticatedUser();
        ensureAccess(user, 'recipes');

        const result = await db.transaction(async (tx) => {
            const [newRecipe] = await tx.insert(recipe).values({
                userId: user.id,
                name: data.name,
                description: data.description || null,
                instructions: data.instructions || null,
                portions: data.portions || 1,
            }).returning();

            let ingredients: any[] = [];
            if (typeof data.ingredients === 'string') {
                try { ingredients = JSON.parse(data.ingredients); } catch { ingredients = []; }
            } else if (Array.isArray(data.ingredients)) {
                ingredients = data.ingredients;
            }

            if (ingredients.length > 0) {
                await tx.insert(recipeConsumable).values(
                    ingredients.map((ing: any) => ({
                        recipeId: newRecipe.id,
                        consumableId: ing.consumableId,
                        amount: typeof ing.amount === 'number' ? ing.amount : parseFloat(String(ing.amount)) || 1,
                        unit: ing.unit || null,
                    }))
                );
            }

            return newRecipe;
        });

        try {
            await requested(listRecipes, 20).refreshAll();
        } catch (e) {
            console.warn('--- createRecipe requested refresh warning ---', e);
        }
        try {
            await listRecipes().refresh();
        } catch (refreshErr) {
            console.warn('--- createRecipe refresh warning ---', refreshErr);
        }
        console.log('--- createRecipe SUCCESS ---', result.id);

        return {
            success: true,
            recipe: {
                ...result,
                createdAt: result.createdAt.toISOString(),
                updatedAt: result.updatedAt.toISOString(),
            }
        };
    } catch (err: any) {
        console.error('--- createRecipe ERROR ---', err);
        return {
            success: false,
            error: {
                message: err?.message || 'Failed to create recipe'
            }
        };
    }
});
