import { type InferSelectModel, eq, desc, getTableColumns, inArray, and } from 'drizzle-orm';
import { query } from '$app/server';
import { resource, location, resourceLocation } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { db } from '$lib/server/db';

export type Resource = InferSelectModel<typeof resource> & { locationName?: string | null };

/**
 * Query: List all resources for the current user
 */
export const listResources = query(async (): Promise<Resource[]> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'resources');

    const resources = await db
        .select({
            ...getTableColumns(resource),
        })
        .from(resource)
        .orderBy(desc(resource.createdAt));

    // Fetch all location associations for these resources
    const resourceIds = resources.map(r => r.id);
    if (resourceIds.length === 0) return [];

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

    return resources.map(r => ({
        ...r,
        locationName: locationMap.get(r.id)?.join(', ') || null,
    })) as Resource[];
});
