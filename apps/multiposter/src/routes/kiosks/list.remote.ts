import { query } from '$app/server';
import { db } from '$lib/server/db';
import { kiosk } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { PaginationSchema, type Kiosk, type PaginatedResult } from '@ac/validations';
import { desc } from 'drizzle-orm';


/**
 * List all Kiosks
 */
export const listKiosks = query(PaginationSchema, async (input): Promise<PaginatedResult<Kiosk>> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'kiosks'); // Using 'kiosks' feature access

    const { page = 1, limit = 50, search = '' } = input || {};
    const offset = (page - 1) * limit;

    let baseQuery = db.select().from(kiosk).$dynamic();
    
    const conditions = [];
    if (search) {
        const { ilike, or } = await import('drizzle-orm');
        conditions.push(or(
            ilike(kiosk.name, `%${search}%`),
            ilike(kiosk.description, `%${search}%`)
        ));
    }

    if (conditions.length > 0) {
        const { and } = await import('drizzle-orm');
        baseQuery = baseQuery.where(and(...conditions as any)) as any;
    }

    const { sql } = await import('drizzle-orm');
    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult[0]?.count || 0);

    const data = await baseQuery
        .orderBy(desc(kiosk.createdAt))
        .limit(limit)
        .offset(offset);

    return { data, total };
});
