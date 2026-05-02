import { query } from '$app/server';
import { db } from '@ac/db';
import { resource, resourceLocation, location } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { desc, getTableColumns, and, inArray, eq } from 'drizzle-orm';
import { resourcePaginationSchema as PaginationSchema, type Resource, type PaginatedResult } from '@ac/validations';
import type * as v from 'valibot';

/**
 * Query: List all resources for the current user
 */
export const listResources = query(PaginationSchema, async (input: v.InferOutput<typeof PaginationSchema>): Promise<PaginatedResult<Resource>> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'resources');

    const { page = 1, limit = 50, search = '', locationId } = input || {};
    const offset = (page - 1) * limit;

    let baseQuery = db.select({ id: resource.id }).from(resource).$dynamic();
    
    const conditions = [];
    if (search) {
        const { ilike } = await import('drizzle-orm');
        conditions.push(ilike(resource.name, `%${search}%`));
    }

    if (locationId) {
        const ids = Array.isArray(locationId) ? locationId : [locationId];
        baseQuery = baseQuery.leftJoin(resourceLocation, eq(resource.id, resourceLocation.resourceId)) as any;
        conditions.push(inArray(resourceLocation.locationId, ids));
    }

    if (conditions.length > 0) {
        baseQuery = baseQuery.where(and(...conditions)) as any;
    }

    const { sql } = await import('drizzle-orm');
    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult.rows[0]?.count || 0);

    const paginatedIdsResult = await baseQuery
        .orderBy(desc(resource.createdAt))
        .limit(limit)
        .offset(offset);
        
    const ids = paginatedIdsResult.map(r => r.id);

    if (ids.length === 0) {
        return { data: [], total };
    }

    const rawResults = await db.select({
        ...getTableColumns(resource),
        locationName: location.name,
    })
    .from(resource)
    .leftJoin(resourceLocation, eq(resource.id, resourceLocation.resourceId))
    .leftJoin(location, eq(resourceLocation.locationId, location.id))
    .where(inArray(resource.id, ids))
    .orderBy(desc(resource.createdAt));

    const data = rawResults.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    }));

    return { data, total };
});
