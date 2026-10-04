import { query } from '$app/server';
import { db, recipe, eq } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';
import type { Recipe } from '@ac/validations';

export const readRecipe = query(v.string(), async (id: string): Promise<Recipe | null> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'recipes');

    const r = await db.query.recipe.findFirst({
        where: eq(recipe.id, id),
        with: {
            consumables: {
                with: {
                    consumable: true,
                }
            }
        }
    });

    if (!r) return null;

    let totalCost = 0;
    const ingredients = (r.consumables || []).map((rc: any) => {
        const c = rc.consumable;
        const costPerUnit = c ? (c.amount > 0 ? c.purchasePrice / c.amount : c.purchasePrice) : 0;
        const ingredientCost = costPerUnit * rc.amount;
        totalCost += ingredientCost;

        return {
            consumableId: rc.consumableId,
            amount: rc.amount,
            unit: rc.unit || c?.unit || null,
            ingredientCost: Math.round(ingredientCost * 100) / 100,
            consumable: c ? {
                ...c,
                expirationDate: c.expirationDate ? c.expirationDate.toISOString() : null,
                createdAt: c.createdAt.toISOString(),
                updatedAt: c.updatedAt.toISOString(),
                costPerUnit: Math.round(costPerUnit * 100) / 100,
            } : null,
        };
    });

    const portions = r.portions > 0 ? r.portions : 1;
    const costPerPortion = totalCost / portions;

    return {
        id: r.id,
        userId: r.userId,
        name: r.name,
        description: r.description,
        instructions: r.instructions,
        portions: r.portions,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        consumables: ingredients,
        totalCost: Math.round(totalCost * 100) / 100,
        costPerPortion: Math.round(costPerPortion * 100) / 100,
    };
});
