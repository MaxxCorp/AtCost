import { query } from '$app/server';
import { db } from '$lib/server/db';
import { kiosk, kioskLocation, location } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { desc, eq, inArray, and, or, ilike, sql } from 'drizzle-orm';
import { kioskPaginationSchema as PaginationSchema, type Kiosk, type PaginatedResult } from '@ac/validations';
import * as v from 'valibot';

/**
 * List all Kiosks
 */
export const listKiosks = query(PaginationSchema, async (input: v.InferOutput<typeof PaginationSchema>): Promise<PaginatedResult<Kiosk>> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'kiosks'); // Using 'kiosks' feature access

    const { page = 1, limit = 50, search = '', locationId } = input || {};
    const offset = (page - 1) * limit;

    let baseQuery = db.select({ id: kiosk.id }).from(kiosk).$dynamic();
    
    const conditions = [];
    if (search) {
        conditions.push(or(
            ilike(kiosk.name, `%${search}%`),
            ilike(kiosk.description, `%${search}%`)
        ));
    }

    if (locationId) {
        const ids = Array.isArray(locationId) ? locationId : [locationId];
        baseQuery = baseQuery.leftJoin(kioskLocation, eq(kiosk.id, kioskLocation.kioskId)) as any;
        conditions.push(inArray(kioskLocation.locationId, ids));
    }

    if (conditions.length > 0) {
        baseQuery = baseQuery.where(and(...conditions as any)) as any;
    }

    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult[0]?.count || 0);

    const paginatedIdsResult = await baseQuery
        .orderBy(desc(kiosk.createdAt))
        .limit(limit)
        .offset(offset);

    const ids = paginatedIdsResult.map(r => r.id);

    if (ids.length === 0) {
        return { data: [], total };
    }

    const rawResults = await db
        .select()
        .from(kiosk)
        .where(inArray(kiosk.id, ids))
        .orderBy(desc(kiosk.createdAt));

    const data = rawResults.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        startDate: row.startDate?.toISOString() || null,
        endDate: row.endDate?.toISOString() || null,
    }));

    return { data, total };
});
