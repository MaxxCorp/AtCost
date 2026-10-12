import { form, requested, command } from '$app/server';
import { db, menu, menuItem, eq, and } from '@ac/db';
import { listPrices } from '../list.remote';
import { readPrice } from './read.remote';
import { fetchEntityPrices } from '../associate.remote';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import {
    updatePriceSchema,
    removePriceItemSchema,
    updatePriceItemSchema,
} from '@ac/validations';

export const updatePrice = form(updatePriceSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'prices');

    const result = await db.transaction(async (tx) => {
        const [updatedMenu] = await tx
            .update(menu)
            .set({
                name: data.name,
                description: data.description || null,
                isTemplate: data.isTemplate !== undefined ? Boolean(data.isTemplate) : true,
            })
            .where(eq(menu.id, data.id))
            .returning();

        if (!updatedMenu) {
            throw new Error('Price list not found');
        }

        // Delete existing items and re-insert
        await tx.delete(menuItem).where(eq(menuItem.menuId, data.id));

        let items: any[] = [];
        if (typeof data.items === 'string') {
            try { items = JSON.parse(data.items); } catch { items = []; }
        } else if (Array.isArray(data.items)) {
            items = data.items;
        }

        if (items.length > 0) {
            await tx.insert(menuItem).values(
                items.map((it: any, index: number) => ({
                    menuId: data.id,
                    itemType: it.itemType || 'consumable',
                    consumableId: it.itemType === 'consumable' ? (it.consumableId || null) : null,
                    recipeId: it.itemType === 'recipe' ? (it.recipeId || null) : null,
                    name: it.name || '',
                    description: it.description || null,
                    portionAmount: typeof it.portionAmount === 'number' ? it.portionAmount : parseFloat(String(it.portionAmount)) || 1,
                    unit: it.unit || null,
                    costPrice: typeof it.costPrice === 'number' ? it.costPrice : parseFloat(String(it.costPrice)) || 0,
                    factor: typeof it.factor === 'number' ? it.factor : parseFloat(String(it.factor)) || 2,
                    unitPrice: typeof it.unitPrice === 'number' ? it.unitPrice : parseFloat(String(it.unitPrice)) || 0,
                    sortOrder: it.sortOrder != null ? Number(it.sortOrder) : index,
                }))
            );
        }

        return updatedMenu;
    });

    try {
        await requested(listPrices, 20).refreshAll();
        await requested(fetchEntityPrices, 20).refreshAll();
    } catch (e) {
        console.warn('--- updatePrice requested refresh warning ---', e);
    }
    try {
        await listPrices().refresh();
        await readPrice(data.id).refresh();
    } catch (refreshErr) {
        console.warn('--- updatePrice refresh warning ---', refreshErr);
    }

    return {
        success: true,
        data: {
            ...result,
            createdAt: result.createdAt.toISOString(),
            updatedAt: result.updatedAt.toISOString(),
        }
    };
});

export const removePriceItem = command(removePriceItemSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'prices');

    await db.delete(menuItem).where(
        and(eq(menuItem.menuId, data.priceId), eq(menuItem.id, data.itemId))
    );

    try {
        await requested(listPrices, 20).refreshAll();
        await requested(fetchEntityPrices, 20).refreshAll();
    } catch (e) {
        console.warn('--- removePriceItem requested refresh warning ---', e);
    }
    try {
        await listPrices().refresh();
        await readPrice(data.priceId).refresh();
    } catch (refreshErr) {
        console.warn('--- removePriceItem refresh warning ---', refreshErr);
    }

    return { success: true };
});

export const updatePriceItem = command(updatePriceItemSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'prices');

    const it = data.item;
    if (it.id) {
        await db.update(menuItem).set({
            name: it.name,
            description: it.description || null,
            portionAmount: typeof it.portionAmount === 'number' ? it.portionAmount : parseFloat(String(it.portionAmount)) || 1,
            unit: it.unit || null,
            costPrice: typeof it.costPrice === 'number' ? it.costPrice : parseFloat(String(it.costPrice)) || 0,
            factor: typeof it.factor === 'number' ? it.factor : parseFloat(String(it.factor)) || 2,
            unitPrice: typeof it.unitPrice === 'number' ? it.unitPrice : parseFloat(String(it.unitPrice)) || 0,
            sortOrder: it.sortOrder != null ? Number(it.sortOrder) : 0,
        }).where(and(eq(menuItem.menuId, data.priceId), eq(menuItem.id, it.id)));
    }

    try {
        await requested(listPrices, 20).refreshAll();
        await requested(fetchEntityPrices, 20).refreshAll();
    } catch (e) {
        console.warn('--- updatePriceItem requested refresh warning ---', e);
    }
    try {
        await listPrices().refresh();
        await readPrice(data.priceId).refresh();
    } catch (refreshErr) {
        console.warn('--- updatePriceItem refresh warning ---', refreshErr);
    }

    return { success: true };
});

