import { query } from '$app/server';
import { db } from '@ac/db';
import { resource, resourceLocation, location } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { desc, getTableColumns, and, inArray, eq } from '@ac/db';
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
        const { ilike } = await import('@ac/db');
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

    const { sql } = await import('@ac/db');
    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult[0]?.count || 0);

    const paginatedIdsResult = await baseQuery
        .orderBy(desc(resource.createdAt))
        .limit(limit)
        .offset(offset);
        
    const ids = paginatedIdsResult.map(r => r.id);

    if (ids.length === 0) {
        return { data: [], total };
    }

    const resources = await db.select({
        ...getTableColumns(resource),
    })
    .from(resource)
    .where(inArray(resource.id, ids))
    .orderBy(desc(resource.createdAt));

    // Fetch all location associations for these resource IDs to group them in memory
    const locationMap = new Map<string, string[]>();
    const locAssociations = await db
        .select({
            resourceId: resourceLocation.resourceId,
            locationName: location.name,
        })
        .from(resourceLocation)
        .innerJoin(location, eq(resourceLocation.locationId, location.id))
        .where(inArray(resourceLocation.resourceId, ids));

    locAssociations.forEach(assoc => {
        const names = locationMap.get(assoc.resourceId) || [];
        names.push(assoc.locationName);
        locationMap.set(assoc.resourceId, names);
    });

    const data = resources.map((row) => ({
        ...row,
        locationName: locationMap.get(row.id)?.join(', ') || null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    }));

    return { data, total };
});
