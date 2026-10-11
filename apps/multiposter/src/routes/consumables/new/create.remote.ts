import { form, requested } from '$app/server';
import { db, consumable, consumableTag, tag, eq } from '@ac/db';
import { listConsumables } from '../list.remote';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
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

        // Tags persistence
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
                await db.insert(consumableTag).values({ consumableId: newConsumable.id, tagId: existingTag.id }).onConflictDoNothing();
            }
        }

        let tagIds: string[] = [];
        if (Array.isArray(data.tagIds)) {
            tagIds = data.tagIds;
        } else if (typeof data.tagIds === 'string') {
            try { tagIds = JSON.parse(data.tagIds); } catch {}
        }
        for (const tagId of tagIds) {
            await db.insert(consumableTag).values({ consumableId: newConsumable.id, tagId }).onConflictDoNothing();
        }


        try {
            await requested(listConsumables, 20).refreshAll();
        } catch (e) {
            console.warn('--- createConsumable requested refresh warning ---', e);
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
