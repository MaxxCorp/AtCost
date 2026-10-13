import { query } from '$app/server';
import { db, consumable, eq } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import * as v from 'valibot';
import type { Consumable } from '@ac/validations';

export const readConsumable = query(v.string(), async (id: string): Promise<Consumable | null> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'consumables');

    const row = await db.query.consumable.findFirst({
        where: eq(consumable.id, id),
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

    if (!row) return null;

    const costPerUnit = row.amount > 0 ? row.purchasePrice / row.amount : row.purchasePrice;

    return {
        ...row,
        expirationDate: row.expirationDate ? row.expirationDate.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        costPerUnit: costPerUnit > 0 && costPerUnit < 0.01 ? Number(costPerUnit.toFixed(4)) : Math.round(costPerUnit * 100) / 100,
        tags: (row.tags || []).map((t: any) => t.tag).filter(Boolean),
    };
});

