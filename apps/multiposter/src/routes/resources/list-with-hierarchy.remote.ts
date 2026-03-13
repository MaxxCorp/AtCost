import { type InferSelectModel, eq, getTableColumns, inArray, and } from 'drizzle-orm';
import { query } from '$app/server';
import { resource, resourceRelation, location, resourceLocation } from '$lib/server/db/schema';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { db } from '$lib/server/db';

export type ResourceWithHierarchy = InferSelectModel<typeof resource> & {
    locationName?: string | null;
    parentIds: string[];
    childIds: string[];
    level: number; // Depth in hierarchy (0 = root)
};

/**
 * Query: List all resources with their parent-child relationships
 */
export const listResourcesWithHierarchy = query(async (): Promise<ResourceWithHierarchy[]> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'resources');

    // Fetch all resources
    const resources = await db
        .select({
            ...getTableColumns(resource),
        })
        .from(resource);

    // Fetch all location associations for these resources
    const resourceIds = resources.map(r => r.id);
    const locationMap = new Map<string, string[]>();

    if (resourceIds.length > 0) {
        const locAssociations = await db
            .select({
                resourceId: resourceLocation.resourceId,
                locationName: location.name,
            })
            .from(resourceLocation)
            .innerJoin(location, eq(resourceLocation.locationId, location.id))
            .where(and(inArray(resourceLocation.resourceId, resourceIds)));

        locAssociations.forEach(assoc => {
            const names = locationMap.get(assoc.resourceId) || [];
            names.push(assoc.locationName);
            locationMap.set(assoc.resourceId, names);
        });
    }

    const resourcesWithLocation = resources.map(r => ({
        ...r,
        locationName: locationMap.get(r.id)?.join(', ') || null,
    }));

    // Fetch all relationships
    const relations = await db
        .select()
        .from(resourceRelation);

    // Build hierarchy map
    const resourceMap = new Map<string, ResourceWithHierarchy>();
    const parentMap = new Map<string, string[]>(); // childId -> parentIds[]
    const childMap = new Map<string, string[]>(); // parentId -> childIds[]

    // Initialize maps
    resourcesWithLocation.forEach(r => {
        resourceMap.set(r.id, {
            ...r,
            parentIds: [],
            childIds: [],
            level: 0,
        });
        parentMap.set(r.id, []);
        childMap.set(r.id, []);
    });

    // Populate parent-child relationships
    relations.forEach(rel => {
        const parentIds = parentMap.get(rel.childResourceId);
        if (parentIds) parentIds.push(rel.parentResourceId);

        const childIds = childMap.get(rel.parentResourceId);
        if (childIds) childIds.push(rel.childResourceId);
    });

    // Apply relationships to resources
    resourceMap.forEach((resource, id) => {
        resource.parentIds = parentMap.get(id) || [];
        resource.childIds = childMap.get(id) || [];
    });

    // Calculate levels (BFS from roots)
    const roots = Array.from(resourceMap.values()).filter(r => r.parentIds.length === 0);
    const queue: Array<{ id: string; level: number }> = roots.map(r => ({ id: r.id, level: 0 }));
    const visited = new Set<string>();

    while (queue.length > 0) {
        const { id, level } = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);

        const resource = resourceMap.get(id);
        if (resource) {
            resource.level = level;
            resource.childIds.forEach(childId => {
                if (!visited.has(childId)) {
                    queue.push({ id: childId, level: level + 1 });
                }
            });
        }
    }

    // Convert to array and sort by level, then name
    return Array.from(resourceMap.values()).sort((a, b) => {
        if (a.level !== b.level) return a.level - b.level;
        return a.name.localeCompare(b.name);
    });
});
