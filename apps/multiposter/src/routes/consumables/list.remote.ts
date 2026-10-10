import { query } from '$app/server';
import { db, consumable } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { desc, asc, and, ilike, count, sql } from '@ac/db';
import { consumablePaginationSchema as PaginationSchema, type Consumable, type PaginatedResult } from '@ac/validations';
import type * as v from 'valibot';

export const listConsumables = query(PaginationSchema, async (input: v.InferOutput<typeof PaginationSchema>): Promise<PaginatedResult<Consumable>> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'consumables');

    const { page = 1, limit = 50, search = '', storageLocation = '', sortField = 'name', sortOrder = 'asc' } = input || {};
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (search) {
        conditions.push(ilike(consumable.name, `%${search}%`));
    }

    if (storageLocation) {
        conditions.push(ilike(consumable.storageLocation, `%${storageLocation}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Total count
    const [countResult] = await db
        .select({ count: count() })
        .from(consumable)
        .where(whereClause);
    const total = Number(countResult?.count || 0);

    // Sort order
    let orderColumn: any = consumable.name;
    if (sortField === 'purchasePrice') orderColumn = consumable.purchasePrice;
    else if (sortField === 'amount') orderColumn = consumable.amount;
    else if (sortField === 'storageLocation') orderColumn = consumable.storageLocation;
    else if (sortField === 'expirationDate') orderColumn = consumable.expirationDate;
    else if (sortField === 'createdAt') orderColumn = consumable.createdAt;
    else if (sortField === 'updatedAt') orderColumn = consumable.updatedAt;

    const orderFn = sortOrder === 'desc' ? desc : asc;

    const rows = await db
        .select()
        .from(consumable)
        .where(whereClause)
        .orderBy(orderFn(orderColumn))
        .limit(limit)
        .offset(offset);

    const data: Consumable[] = rows.map((r) => {
        const costPerUnit = r.amount > 0 ? r.purchasePrice / r.amount : r.purchasePrice;
        return {
            ...r,
            expirationDate: r.expirationDate ? r.expirationDate.toISOString() : null,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
            costPerUnit: Math.round(costPerUnit * 100) / 100,
        };
    });

    return {
        data,
        total,
    };
});
