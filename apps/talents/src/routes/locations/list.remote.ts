import * as v from 'valibot';
import { type InferSelectModel, db, desc, and, or, ilike, sql } from '$lib/server/db';
import { query } from '$app/server';
import { location } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';

import { LocationPaginationSchema as PaginationSchema, type Location, type PaginatedResult } from '@ac/validations';


export const listLocations = query(PaginationSchema, async (input): Promise<PaginatedResult<Location>> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'locations');

    const { page = 1, limit = 50, search = '', city } = input || {};
    const offset = (page - 1) * limit;

    let baseQuery = db.select().from(location).$dynamic();
    
    const conditions: any[] = [];
    if (search) {
        conditions.push(or(
            ilike(location.name, `%${search}%`),
            ilike(location.city, `%${search}%`),
            ilike(location.street, `%${search}%`)
        ));
    }

    if (city) {
        const { inArray } = await import('drizzle-orm');
        const cities = Array.isArray(city) ? city : [city];
        if (cities.length > 0) {
            conditions.push(inArray(location.city, cities as any));
        }
    }

    if (conditions.length > 0) {
        baseQuery = baseQuery.where(and(...conditions as any)) as any;
    }

    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult[0]?.count || 0);

    const rawResults = await baseQuery
        .orderBy(desc(location.createdAt))
        .limit(limit)
        .offset(offset);

    const data = rawResults.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    }));

    return { data, total };
});
