import { query } from '$app/server';
import { db } from '$lib/server/db';
import { resource, resourceLocation, location } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { PaginationSchema, type Resource, type PaginatedResult } from '@ac/validations';
import { desc, getTableColumns, and, inArray, eq } from 'drizzle-orm';


/**
 * Query: List all resources for the current user
 */
export const listResources = query(PaginationSchema, async (input): Promise<PaginatedResult<Resource>> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'resources');

    const { page = 1, limit = 50, search = '' } = input || {};
    const offset = (page - 1) * limit;

    let baseQuery = db.select({
        ...getTableColumns(resource),
    }).from(resource).$dynamic();
    
    const conditions = [];
    if (search) {
        const { ilike, or } = await import('drizzle-orm');
        conditions.push(or(
            ilike(resource.name, `%${search}%`),
            ilike(resource.type, `%${search}%`)
        ));
    }

    if (conditions.length > 0) {
        const { and } = await import('drizzle-orm');
        baseQuery = baseQuery.where(and(...conditions as any)) as any;
    }

    const { sql } = await import('drizzle-orm');
    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult[0]?.count || 0);

    const resources = await baseQuery
        .orderBy(desc(resource.createdAt))
        .limit(limit)
        .offset(offset);

    // Fetch all location associations for these resources
    const resourceIds = resources.map(r => r.id);
    if (resourceIds.length === 0) return { data: [], total };

    const locAssociations = await db
        .select({
            resourceId: resourceLocation.resourceId,
            locationName: location.name,
        })
        .from(resourceLocation)
        .innerJoin(location, eq(resourceLocation.locationId, location.id))
        .where(and(inArray(resourceLocation.resourceId, resourceIds)));

    // Map locations back to resources
    const locationMap = new Map<string, string[]>();
    locAssociations.forEach(assoc => {
        const names = locationMap.get(assoc.resourceId) || [];
        names.push(assoc.locationName);
        locationMap.set(assoc.resourceId, names);
    });

    const data = resources.map(r => ({
        ...r,
        locationName: locationMap.get(r.id)?.join(', ') || null,
    })) as Resource[];

    return { data, total };
});
