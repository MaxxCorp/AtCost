import { form } from '$app/server';
import { db, consumable, eq } from '@ac/db';
import { listConsumables } from '../list.remote';
import { readConsumable } from './read.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { updateConsumableSchema } from '@ac/validations';

export const updateConsumable = form(updateConsumableSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'consumables');

    const expirationDate = data.expirationDate ? new Date(data.expirationDate) : null;

    const [updated] = await db
        .update(consumable)
        .set({
            name: data.name,
            description: data.description || null,
            purchasePrice: typeof data.purchasePrice === 'number' ? data.purchasePrice : parseFloat(String(data.purchasePrice)) || 0,
            unit: data.unit,
            amount: data.amount != null ? (typeof data.amount === 'number' ? data.amount : parseFloat(String(data.amount)) || 1) : 1,
            storageLocation: data.storageLocation || null,
            expirationDate,
        })
        .where(eq(consumable.id, data.id))
        .returning();

    if (!updated) {
        throw new Error('Consumable not found');
    }

    await listConsumables().refresh();
    await readConsumable(data.id).refresh();

    return {
        success: true,
        consumable: {
            ...updated,
            expirationDate: updated.expirationDate ? updated.expirationDate.toISOString() : null,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
        }
    };
});
