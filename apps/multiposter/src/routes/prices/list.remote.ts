import { query } from '$app/server';
import { db, menu, and, eq, ilike, desc, asc, count } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { pricePaginationSchema as PaginationSchema, type Price, type PaginatedResult } from '@ac/validations';
import type * as v from 'valibot';

export const listPrices = query(PaginationSchema, async (input: v.InferOutput<typeof PaginationSchema>): Promise<PaginatedResult<Price>> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'prices');

    const { page = 1, limit = 50, search = '', isTemplate, sortField = 'name', sortOrder = 'asc' } = input || {};
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (search) {
        conditions.push(ilike(menu.name, `%${search}%`));
    }

    if (isTemplate !== undefined) {
        const isTpl = typeof isTemplate === 'string' ? isTemplate === 'true' : Boolean(isTemplate);
        conditions.push(eq(menu.isTemplate, isTpl));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
        .select({ count: count() })
        .from(menu)
        .where(whereClause);
    const total = Number(countResult?.count || 0);

    let orderColumn: any = menu.name;
    if (sortField === 'isTemplate') orderColumn = menu.isTemplate;
    else if (sortField === 'createdAt') orderColumn = menu.createdAt;
    else if (sortField === 'updatedAt') orderColumn = menu.updatedAt;
    else if (sortField === 'displayName' || sortField === 'name') orderColumn = menu.name;

    const orderFn = sortOrder === 'desc' ? desc : asc;

    const rows = await db.query.menu.findMany({
        where: whereClause,
        orderBy: [orderFn(orderColumn)],
        limit,
        offset,
        with: {
            items: {
                with: {
                    consumable: {
                        with: {
                            tags: { with: { tag: { with: { category: true } } } }
                        }
                    },
                    recipe: {
                        with: {
                            tags: { with: { tag: { with: { category: true } } } }
                        }
                    },
                }
            }
        }
    });

    const data: Price[] = rows.map((m: any) => {
        let totalPricePerPortion = 0;
        let totalCostPerPortion = 0;
        const items = (m.items || []).map((it: any) => {
            const linePricePerPortion = (it.unitPrice || 0) * (it.portionAmount || 1);
            const lineCostPerPortion = (it.costPrice || 0) * (it.portionAmount || 1);
            totalPricePerPortion += linePricePerPortion;
            totalCostPerPortion += lineCostPerPortion;

            const itemTags = it.itemType === 'recipe'
                ? (it.recipe?.tags || []).map((t: any) => t.tag || t).filter(Boolean)
                : (it.consumable?.tags || []).map((t: any) => t.tag || t).filter(Boolean);

            return {
                id: it.id,
                menuId: it.menuId,
                itemType: it.itemType,
                consumableId: it.consumableId,
                recipeId: it.recipeId,
                name: it.name,
                description: it.description,
                portionAmount: it.portionAmount,
                unit: it.unit,
                costPrice: it.costPrice,
                factor: it.factor,
                unitPrice: it.unitPrice,
                sortOrder: it.sortOrder,
                tags: itemTags,
                consumable: it.consumable ? {
                    ...it.consumable,
                    expirationDate: it.consumable.expirationDate ? it.consumable.expirationDate.toISOString() : null,
                    createdAt: it.consumable.createdAt.toISOString(),
                    updatedAt: it.consumable.updatedAt.toISOString(),
                    tags: (it.consumable.tags || []).map((t: any) => t.tag || t).filter(Boolean),
                } : null,
                recipe: it.recipe ? {
                    ...it.recipe,
                    createdAt: it.recipe.createdAt.toISOString(),
                    updatedAt: it.recipe.updatedAt.toISOString(),
                    tags: (it.recipe.tags || []).map((t: any) => t.tag || t).filter(Boolean),
                } : null,
            };
        });

        return {
            id: m.id,
            userId: m.userId,
            name: m.name,
            description: m.description,
            isTemplate: m.isTemplate,
            createdAt: m.createdAt.toISOString(),
            updatedAt: m.updatedAt.toISOString(),
            items,
            totalPricePerPortion: Math.round(totalPricePerPortion * 100) / 100,
            totalCostPerPortion: Math.round(totalCostPerPortion * 100) / 100,
        };
    });

    return {
        data,
        total,
    };
});
