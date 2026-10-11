import { form, requested } from '$app/server';
import { db, recipe, recipeConsumable, recipeTag, tag, eq } from '@ac/db';
import { listRecipes } from '../list.remote';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
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

            // Tags persistence
            const tagNames: string[] = [];
            if (typeof data.tags === 'string') {
                tagNames.push(...data.tags.split(',').map((t: string) => t.trim()).filter(Boolean));
            } else if (Array.isArray(data.tags)) {
                tagNames.push(...data.tags.map((t: string) => String(t).trim()).filter(Boolean));
            }
            if (data.tagNames) {
                try {
                    const parsed = JSON.parse(data.tagNames);
                    if (Array.isArray(parsed)) tagNames.push(...parsed.map((t: string) => String(t).trim()).filter(Boolean));
                } catch {}
            }

            for (const name of tagNames) {
                let [existingTag] = await tx.select().from(tag).where(eq(tag.name, name));
                if (!existingTag) {
                    [existingTag] = await tx.insert(tag).values({ name, userId: user.id }).returning();
                }
                if (existingTag) {
                    await tx.insert(recipeTag).values({ recipeId: newRecipe.id, tagId: existingTag.id }).onConflictDoNothing();
                }
            }

            let tagIds: string[] = [];
            if (Array.isArray(data.tagIds)) {
                tagIds = data.tagIds;
            } else if (typeof data.tagIds === 'string') {
                try { tagIds = JSON.parse(data.tagIds); } catch {}
            }
            for (const tagId of tagIds) {
                await tx.insert(recipeTag).values({ recipeId: newRecipe.id, tagId }).onConflictDoNothing();
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
