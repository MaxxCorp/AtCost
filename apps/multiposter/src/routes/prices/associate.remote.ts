import { command, query } from '$app/server';
import { db, eventPrice, eq } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { priceAssociationSchema, getPriceAssociationsSchema } from '@ac/validations';
import { addAssociation as dbAddAssociation, removeAssociation as dbRemoveAssociation } from '#lib/server/associations.js';
import { resolveEventIdForAssociations } from '#lib/server/events/exceptions.js';

const tableMap = {
    event: eventPrice,
} as const;

const fieldMap = {
    event: 'eventId',
} as const;

export const addPriceAssociation = command(priceAssociationSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'prices');

    const { type, entityId, priceId, priceListId } = data;
    const targetId = priceId || priceListId;
    if (!targetId) throw new Error('Missing price list ID');

    await dbAddAssociation({
        type,
        entityId,
        itemId: targetId,
        tableMap,
        fieldMap,
        itemField: 'priceId',
        userId: user?.id
    });

    await fetchEntityPrices({ type, entityId }).refresh();
    return { success: true };
});

export const removePriceAssociation = command(priceAssociationSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'prices');

    const { type, entityId, priceId, priceListId } = data;
    const targetId = priceId || priceListId;
    if (!targetId) throw new Error('Missing price list ID');

    await dbRemoveAssociation({
        type,
        entityId,
        itemId: targetId,
        tableMap,
        fieldMap,
        itemField: 'priceId',
        userId: user?.id
    });

    await fetchEntityPrices({ type, entityId }).refresh();
    return { success: true };
});

export const fetchEntityPrices = query(getPriceAssociationsSchema, async (data) => {
    const { type, entityId } = data;

    const table = tableMap[type as keyof typeof tableMap];
    const entityField = fieldMap[type as keyof typeof fieldMap];

    if (!table || !entityField) {
        throw new Error(`Unsupported entity type: ${type}`);
    }

    let targetEntityId = entityId;
    if (type === 'event' && entityId.includes('_inst_')) {
        targetEntityId = await resolveEventIdForAssociations(entityId, { materializeIfVirtual: false });
    }

    const rows = await db.query.eventPrice.findMany({
        where: eq((eventPrice as any)[entityField], targetEntityId),
        with: {
            price: {
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
            }
        }
    });

    return rows.map((r: any) => {
        const p = r.price;
        if (!p) return null;

        let totalPricePerPortion = 0;
        const items = (p.items || []).map((it: any) => {
            const linePricePerPortion = (it.unitPrice || 0) * (it.portionAmount || 1);
            totalPricePerPortion += linePricePerPortion;

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
        };
    }).filter(Boolean);
});
