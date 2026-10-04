import { form, requested } from '$app/server';
import { db, consumable, eq } from '@ac/db';
import { listConsumables } from '../list.remote';
import { readConsumable } from './read.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { updateConsumableSchema } from '@ac/validations';

export const updateConsumable = form(updateConsumableSchema, async (data) => {
    console.log('--- updateConsumable START ---', JSON.stringify(data));
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

        const [updated] = await db
            .update(consumable)
            .set({
                name: data.name,
                description: data.description || null,
                purchasePrice,
                unit: data.unit || 'piece',
                amount,
                storageLocation: data.storageLocation || null,
                expirationDate,
            })
            .where(eq(consumable.id, data.id))
            .returning();

        if (!updated) {
            throw new Error('Consumable not found');
        }

        try {
            await requested(listConsumables, 20).refreshAll();
        } catch (e) {
            console.warn('--- updateConsumable requested refresh warning ---', e);
        }
        try {
            await listConsumables().refresh();
            await readConsumable(data.id).refresh();
        } catch (refreshErr) {
            console.warn('--- updateConsumable refresh warning ---', refreshErr);
        }
        console.log('--- updateConsumable SUCCESS ---', updated.id);

        return {
            success: true,
            consumable: {
                ...updated,
                expirationDate: updated.expirationDate ? updated.expirationDate.toISOString() : null,
                createdAt: updated.createdAt.toISOString(),
                updatedAt: updated.updatedAt.toISOString(),
            }
        };
    } catch (err: any) {
        console.error('--- updateConsumable ERROR ---', err);
        return {
            success: false,
            error: {
                message: err?.message || 'Failed to update consumable'
            }
        };
    }
});
