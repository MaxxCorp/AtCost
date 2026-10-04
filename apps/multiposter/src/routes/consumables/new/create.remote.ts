import { form } from '$app/server';
import { db, consumable } from '@ac/db';
import { listConsumables } from '../list.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { createConsumableSchema } from '@ac/validations';

export const createConsumable = form(createConsumableSchema, async (data) => {
    console.log('--- createConsumable START ---', JSON.stringify(data));
    try {
        const user = getAuthenticatedUser();
        ensureAccess(user, 'consumables');

        let expirationDate: Date | null = null;
        if (data.expirationDate && typeof data.expirationDate === 'string' && data.expirationDate.trim() !== '') {
            const parsed = new Date(data.expirationDate);
            if (!isNaN(parsed.getTime())) {
                expirationDate = parsed;
            }
        }

        const purchasePrice = data.purchasePrice !== undefined && data.purchasePrice !== null && data.purchasePrice !== ''
            ? (typeof data.purchasePrice === 'number' ? data.purchasePrice : parseFloat(String(data.purchasePrice)) || 0)
            : 0;

        const amount = data.amount !== undefined && data.amount !== null && data.amount !== ''
            ? (typeof data.amount === 'number' ? data.amount : parseFloat(String(data.amount)) || 1)
            : 1;

        const [newConsumable] = await db.insert(consumable).values({
            userId: user.id,
            name: data.name,
            description: data.description || null,
            purchasePrice,
            unit: data.unit || 'piece',
            amount,
            storageLocation: data.storageLocation || null,
            expirationDate,
        }).returning();

        if (!newConsumable) {
            throw new Error('Database insert returned no record');
        }

        try {
            await listConsumables().refresh();
        } catch (refreshErr) {
            console.warn('--- createConsumable refresh warning ---', refreshErr);
        }
        console.log('--- createConsumable SUCCESS ---', newConsumable.id);

        return {
            success: true,
            consumable: {
                ...newConsumable,
                expirationDate: newConsumable.expirationDate ? newConsumable.expirationDate.toISOString() : null,
                createdAt: newConsumable.createdAt.toISOString(),
                updatedAt: newConsumable.updatedAt.toISOString(),
            }
        };
    } catch (err: any) {
        console.error('--- createConsumable ERROR ---', err);
        return {
            success: false,
            error: {
                message: err?.message || 'Failed to create consumable'
            }
        };
    }
});
