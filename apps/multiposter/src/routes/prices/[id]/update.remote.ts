import { form, requested, command } from '$app/server';
import { db, price, priceItem, eq, and } from '@ac/db';
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
        const [updatedPrice] = await tx
            .update(price)
            .set({
                name: data.name,
                description: data.description || null,
                isTemplate: data.isTemplate !== undefined ? Boolean(data.isTemplate) : true,
            })
            .where(eq(price.id, data.id))
            .returning();

        if (!updatedPrice) {
            throw new Error('Price list not found');
        }

        // Delete existing items and re-insert
        await tx.delete(priceItem).where(eq(priceItem.priceId, data.id));

        let items: any[] = [];
        if (typeof data.items === 'string') {
            try { items = JSON.parse(data.items); } catch { items = []; }
        } else if (Array.isArray(data.items)) {
            items = data.items;
        }

        if (items.length > 0) {
            await tx.insert(priceItem).values(
                items.map((it: any, index: number) => ({
                    priceId: data.id,
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

        return updatedPrice;
    });

    try {
        await requested(listPrices, 20).refreshAll();
        await requested(fetchEntityPrices, 20).refreshAll();
    } catch (e) {
        console.warn('--- updatePrice requested refresh warning ---', e);
    }
    try {
        await listPrices().refresh();
        void listPrices({}).refresh();
        void listPrices({ isTemplate: true, limit: 100 }).refresh();
        await readPrice(data.id).refresh();
    } catch (refreshErr) {
        console.warn('--- updatePrice refresh warning ---', refreshErr);
    }

    const formattedResult = {
        ...result,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
    };

    return {
        success: true,
        id: data.id,
        price: formattedResult,
        data: formattedResult
    };
});

export const removePriceItem = command(removePriceItemSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'prices');

    await db.delete(priceItem).where(
        and(eq(priceItem.priceId, data.priceId), eq(priceItem.id, data.itemId))
    );

    try {
        await requested(listPrices, 20).refreshAll();
        await requested(fetchEntityPrices, 20).refreshAll();
    } catch (e) {
        console.warn('--- removePriceItem requested refresh warning ---', e);
    }
    try {
        await listPrices().refresh();
        void listPrices({}).refresh();
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
        await db.update(priceItem).set({
            name: it.name,
            description: it.description || null,
            portionAmount: typeof it.portionAmount === 'number' ? it.portionAmount : parseFloat(String(it.portionAmount)) || 1,
            unit: it.unit || null,
            costPrice: typeof it.costPrice === 'number' ? it.costPrice : parseFloat(String(it.costPrice)) || 0,
            factor: typeof it.factor === 'number' ? it.factor : parseFloat(String(it.factor)) || 2,
            unitPrice: typeof it.unitPrice === 'number' ? it.unitPrice : parseFloat(String(it.unitPrice)) || 0,
            sortOrder: it.sortOrder != null ? Number(it.sortOrder) : 0,
        }).where(and(eq(priceItem.priceId, data.priceId), eq(priceItem.id, it.id)));
    }

    try {
        await requested(listPrices, 20).refreshAll();
        await requested(fetchEntityPrices, 20).refreshAll();
    } catch (e) {
        console.warn('--- updatePriceItem requested refresh warning ---', e);
    }
    try {
        await listPrices().refresh();
        void listPrices({}).refresh();
        await readPrice(data.priceId).refresh();
    } catch (refreshErr) {
        console.warn('--- updatePriceItem refresh warning ---', refreshErr);
    }

    return { success: true };
});
