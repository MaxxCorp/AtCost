import { query } from '$app/server';
import { db, resource, resourceLocation, location, eventResource } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { desc, getTableColumns, and, or, not, inArray, notInArray, eq, exists, sql, ilike } from '@ac/db';
import { resourcePaginationSchema as PaginationSchema, parseFilterValue, type Resource, type PaginatedResult } from '@ac/validations';
import type * as v from 'valibot';

/**
 * Query: List all resources for the current user
 */
export const listResources = query(PaginationSchema, async (input: v.InferOutput<typeof PaginationSchema>): Promise<PaginatedResult<Resource>> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'resources');

    const { page = 1, limit = 50, search = '', locationId, associatedWith, sortField = 'updatedAt', sortOrder = 'desc' } = input || {};
    const offset = (page - 1) * limit;

    let baseQuery = db.select({ id: resource.id }).from(resource).$dynamic();
    
    const conditions = [];

    if (associatedWith) {
        if (associatedWith.type === 'event') {
            baseQuery = baseQuery.innerJoin(eventResource, eq(resource.id, eventResource.resourceId)) as any;
            conditions.push(eq(eventResource.eventId, associatedWith.id));
        } else {
            conditions.push(sql`1 = 0`);
        }
    }

    if (search) {
        conditions.push(ilike(resource.name, `%${search}%`));
    }

    if (locationId) {
        const { include, exclude } = parseFilterValue(locationId);
        if (include.length > 0) {
            conditions.push(
                or(
                    inArray(resource.locationId, include),
                    exists(
                        db.select({ id: sql`1` })
                          .from(resourceLocation)
                          .where(and(eq(resourceLocation.resourceId, resource.id), inArray(resourceLocation.locationId, include)))
                    )
                )
            );
        }
        if (exclude.length > 0) {
            conditions.push(
                and(
                    notInArray(resource.locationId, exclude),
                    not(exists(
                        db.select({ id: sql`1` })
                          .from(resourceLocation)
                          .where(and(eq(resourceLocation.resourceId, resource.id), inArray(resourceLocation.locationId, exclude)))
                    ))
                )
            );
        }
    }

    if (conditions.length > 0) {
        baseQuery = baseQuery.where(and(...conditions)) as any;
    }

    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult[0]?.count || 0);

    let orderField: any = resource.updatedAt;
	if (sortField === 'name' || sortField === 'displayName') orderField = resource.name;
	else if (sortField === 'createdAt') orderField = resource.createdAt;

	const orderExpression = sortOrder === 'desc' ? sql`${orderField} desc nulls last` : sql`${orderField} asc nulls last`;


    const paginatedIdsResult = await baseQuery
        .orderBy(orderExpression)
        .limit(limit)
        .offset(offset);
        
    const ids = paginatedIdsResult.map((r: any) => r.id);

    if (ids.length === 0) {
        return { data: [], total };
    }

    const resources = await db.query.resource.findMany({
        where: inArray(resource.id, ids),
        with: { user: true },
        orderBy: [orderExpression]
    });

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
