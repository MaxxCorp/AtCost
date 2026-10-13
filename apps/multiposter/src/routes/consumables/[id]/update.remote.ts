import { form, requested } from '$app/server';
import { db, consumable, consumableTag, tag, priceItem, eq } from '@ac/db';
import { listConsumables } from '../list.remote';
import { readConsumable } from './read.remote';
import { fetchEntityPrices } from '../../prices/associate.remote';
import { listPrices } from '../../prices/list.remote';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
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

        // Tags synchronization if provided
        if (data.tags !== undefined || data.tagIds !== undefined || data.tagNames !== undefined) {
            await db.delete(consumableTag).where(eq(consumableTag.consumableId, data.id));

            const tagNames: string[] = [];
            if (typeof data.tags === 'string') {
                tagNames.push(...data.tags.split(',').map((t: string) => t.trim()).filter(Boolean));
            } else if (Array.isArray(data.tags)) {
                tagNames.push(...data.tags.map((t: string) => String(t).trim()).filter(Boolean));
            }
            if (data.tagNames) {
                try {
                    const parsed = JSON.parse(data.tagNames);
                    if (Array.isArray(parsed)) tagNames.push(...parsed.map((t: string) => String(t).trim()).filter(Boolean));
                } catch {}
            }

            for (const name of tagNames) {
                let [existingTag] = await db.select().from(tag).where(eq(tag.name, name));
                if (!existingTag) {
                    [existingTag] = await db.insert(tag).values({ name, userId: user.id }).returning();
                }
                if (existingTag) {
                    await db.insert(consumableTag).values({ consumableId: data.id, tagId: existingTag.id }).onConflictDoNothing();
                }
            }

            let tagIds: string[] = [];
            if (Array.isArray(data.tagIds)) {
                tagIds = data.tagIds;
            } else if (typeof data.tagIds === 'string') {
                try { tagIds = JSON.parse(data.tagIds); } catch {}
            }
            for (const tagId of tagIds) {
                await db.insert(consumableTag).values({ consumableId: data.id, tagId }).onConflictDoNothing();
            }
        }

        // Sync linked price items if any
        const costPerUnit = amount > 0 ? purchasePrice / amount : purchasePrice;
        try {
            const linkedPriceItems = await db.select().from(priceItem).where(eq(priceItem.consumableId, data.id));
            const displayUnit = amount > 1 && data.unit && data.unit !== 'piece'
                ? `${amount} ${data.unit}`
                : (data.unit || 'piece');
            for (const pi of linkedPriceItems) {
                const newUnitPrice = Math.round(purchasePrice * pi.factor * 100) / 100;
                await db.update(priceItem).set({
                    name: data.name,
                    description: data.description || null,
                    unit: displayUnit,
                    costPrice: purchasePrice,
                    unitPrice: newUnitPrice,
                }).where(eq(priceItem.id, pi.id));
            }
        } catch (priceErr) {
            console.warn('--- updateConsumable priceItem sync warning ---', priceErr);
        }

        // Fetch refreshed tags
        const row = await db.query.consumable.findFirst({
            where: eq(consumable.id, data.id),
            with: {
                tags: {
                    with: {
                        tag: {
                            with: {
                                category: true
                            }
                        }
                    }
                }
            }
        });
        const refreshedTags = (row?.tags || []).map((t: any) => t.tag).filter(Boolean);

        try {
            await requested(listConsumables, 20).refreshAll();
            await requested(fetchEntityPrices, 20).refreshAll();
            await requested(listPrices, 20).refreshAll();
        } catch (e) {
            console.warn('--- updateConsumable requested refresh warning ---', e);
        }
        try {
            await listConsumables().refresh();
            await readConsumable(data.id).refresh();
            await listPrices().refresh();
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
                costPerUnit: costPerUnit > 0 && costPerUnit < 0.01 ? Number(costPerUnit.toFixed(4)) : Math.round(costPerUnit * 100) / 100,
                tags: refreshedTags,
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
