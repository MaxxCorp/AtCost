import { query } from '$app/server';
import { db, price, eq } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import * as v from 'valibot';
import type { Price } from '@ac/validations';

export const readPrice = query(v.string(), async (id: string): Promise<Price | null> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'prices');

    const p = await db.query.price.findFirst({
        where: eq(price.id, id),
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
                            tags: { with: { tag: { with: { category: true } } } },
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

    if (!p) return null;

    let totalPricePerPortion = 0;
    let totalCostPerPortion = 0;
    const items = (p.items || []).map((it: any) => {
        const linePricePerPortion = (it.unitPrice || 0) * (it.portionAmount || 1);
        const lineCostPerPortion = (it.costPrice || 0) * (it.portionAmount || 1);
        totalPricePerPortion += linePricePerPortion;
        totalCostPerPortion += lineCostPerPortion;

        const itemTags = it.itemType === 'recipe'
            ? (it.recipe?.tags || []).map((t: any) => t.tag || t).filter(Boolean)
            : (it.consumable?.tags || []).map((t: any) => t.tag || t).filter(Boolean);

        return {
            id: it.id,
            priceId: it.priceId,
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
        id: p.id,
        userId: p.userId,
        name: p.name,
        description: p.description,
        isTemplate: p.isTemplate,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        items,
        totalPricePerPortion: Math.round(totalPricePerPortion * 100) / 100,
        totalCostPerPortion: Math.round(totalCostPerPortion * 100) / 100,
    };
});
