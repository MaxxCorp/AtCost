import { command, query } from '$app/server';
import { db, eventMenu, menu, eq } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { menuAssociationSchema, getMenuAssociationsSchema } from '@ac/validations';
import { addAssociation as dbAddAssociation, removeAssociation as dbRemoveAssociation } from '#lib/server/associations.js';
import { resolveEventIdForAssociations } from '#lib/server/events/exceptions.js';

const tableMap = {
    event: eventMenu,
} as const;

const fieldMap = {
    event: 'eventId',
} as const;

export const addMenuAssociation = command(menuAssociationSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'menus');

    const { type, entityId, menuId } = data;

    await dbAddAssociation({
        type,
        entityId,
        itemId: menuId,
        tableMap,
        fieldMap,
        itemField: 'menuId',
        userId: user?.id
    });

    await fetchEntityMenus({ type, entityId }).refresh();
    return { success: true };
});

export const removeMenuAssociation = command(menuAssociationSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'menus');

    const { type, entityId, menuId } = data;

    await dbRemoveAssociation({
        type,
        entityId,
        itemId: menuId,
        tableMap,
        fieldMap,
        itemField: 'menuId',
        userId: user?.id
    });

    await fetchEntityMenus({ type, entityId }).refresh();
    return { success: true };
});

export const fetchEntityMenus = query(getMenuAssociationsSchema, async (data) => {
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

    const rows = await db.query.eventMenu.findMany({
        where: eq((eventMenu as any)[entityField], targetEntityId),
        with: {
            menu: {
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
        const m = r.menu;
        if (!m) return null;

        let totalPricePerPortion = 0;
        const items = (m.items || []).map((it: any) => {
            const linePricePerPortion = (it.unitPrice || 0) * (it.portionAmount || 1);
            totalPricePerPortion += linePricePerPortion;

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
        };
    }).filter(Boolean);
});
