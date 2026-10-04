import { query } from '$app/server';
import { db, recipe } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { desc, asc, and, ilike, count } from '@ac/db';
import { recipePaginationSchema as PaginationSchema, type Recipe, type PaginatedResult } from '@ac/validations';
import type * as v from 'valibot';

export const listRecipes = query(PaginationSchema, async (input: v.InferOutput<typeof PaginationSchema>): Promise<PaginatedResult<Recipe>> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'recipes');

    const { page = 1, limit = 50, search = '', sortField = 'name', sortOrder = 'asc' } = input || {};
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (search) {
        conditions.push(ilike(recipe.name, `%${search}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
        .select({ count: count() })
        .from(recipe)
        .where(whereClause);
    const total = Number(countResult?.count || 0);

    let orderColumn: any = recipe.name;
    if (sortField === 'portions') orderColumn = recipe.portions;
    else if (sortField === 'createdAt') orderColumn = recipe.createdAt;
    else if (sortField === 'updatedAt') orderColumn = recipe.updatedAt;

    const orderFn = sortOrder === 'desc' ? desc : asc;

    const rows = await db.query.recipe.findMany({
        where: whereClause,
        orderBy: [orderFn(orderColumn)],
        limit,
        offset,
        with: {
            consumables: {
                with: {
                    consumable: true,
                }
            }
        }
    });

    const data: Recipe[] = rows.map((r: any) => {
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

    return {
        data,
        total,
    };
});
