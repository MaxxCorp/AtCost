import { query } from '$app/server';
import { db, menu, eventMenu, and, eq, ilike, desc, asc, count } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { menuPaginationSchema as PaginationSchema, type Menu, type PaginatedResult } from '@ac/validations';
import type * as v from 'valibot';

export const listMenus = query(PaginationSchema, async (input: v.InferOutput<typeof PaginationSchema>): Promise<PaginatedResult<Menu>> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'menus');

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
                    consumable: true,
                    recipe: true,
                }
            }
        }
    });

    const data: Menu[] = rows.map((m: any) => {
        let totalPricePerPortion = 0;
        let totalCostPerPortion = 0;
        const items = (m.items || []).map((it: any) => {
            const linePricePerPortion = (it.unitPrice || 0) * (it.portionAmount || 1);
            const lineCostPerPortion = (it.costPrice || 0) * (it.portionAmount || 1);
            totalPricePerPortion += linePricePerPortion;
            totalCostPerPortion += lineCostPerPortion;

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
                consumable: it.consumable ? {
                    ...it.consumable,
                    expirationDate: it.consumable.expirationDate ? it.consumable.expirationDate.toISOString() : null,
                    createdAt: it.consumable.createdAt.toISOString(),
                    updatedAt: it.consumable.updatedAt.toISOString(),
                } : null,
                recipe: it.recipe ? {
                    ...it.recipe,
                    createdAt: it.recipe.createdAt.toISOString(),
                    updatedAt: it.recipe.updatedAt.toISOString(),
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
