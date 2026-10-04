import { query } from '$app/server';
import { db, menu, eq } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';
import type { Menu } from '@ac/validations';

export const readMenu = query(v.string(), async (id: string): Promise<Menu | null> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'menus');

    const m = await db.query.menu.findFirst({
        where: eq(menu.id, id),
        with: {
            items: {
                with: {
                    consumable: true,
                    recipe: {
                        with: {
                            consumables: {
                                with: {
                                    consumable: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    if (!m) return null;

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
