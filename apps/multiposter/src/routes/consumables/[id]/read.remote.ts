import { query } from '$app/server';
import { db, consumable, eq } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import * as v from 'valibot';
import type { Consumable } from '@ac/validations';

export const readConsumable = query(v.string(), async (id: string): Promise<Consumable | null> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'consumables');

    const [row] = await db
        .select()
        .from(consumable)
        .where(eq(consumable.id, id));

    if (!row) return null;

    const costPerUnit = row.amount > 0 ? row.purchasePrice / row.amount : row.purchasePrice;

    return {
        ...row,
        expirationDate: row.expirationDate ? row.expirationDate.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        costPerUnit: Math.round(costPerUnit * 100) / 100,
    };
});
