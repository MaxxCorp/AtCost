import { form } from '$app/server';
import { db, consumable } from '@ac/db';
import { listConsumables } from '../list.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { createConsumableSchema } from '@ac/validations';

export const createConsumable = form(createConsumableSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'consumables');

    const expirationDate = data.expirationDate ? new Date(data.expirationDate) : null;

    const [newConsumable] = await db.insert(consumable).values({
        userId: user.id,
        name: data.name,
        description: data.description || null,
        purchasePrice: typeof data.purchasePrice === 'number' ? data.purchasePrice : parseFloat(String(data.purchasePrice)) || 0,
        unit: data.unit,
        amount: data.amount != null ? (typeof data.amount === 'number' ? data.amount : parseFloat(String(data.amount)) || 1) : 1,
        storageLocation: data.storageLocation || null,
        expirationDate,
    }).returning();

    await listConsumables().refresh();

    return {
        success: true,
        consumable: {
            ...newConsumable,
            expirationDate: newConsumable.expirationDate ? newConsumable.expirationDate.toISOString() : null,
            createdAt: newConsumable.createdAt.toISOString(),
            updatedAt: newConsumable.updatedAt.toISOString(),
        }
    };
});
