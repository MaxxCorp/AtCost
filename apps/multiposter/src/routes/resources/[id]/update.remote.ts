import { form } from '$app/server';
import { db } from '@ac/db';
import { resource, resourceRelation, resourceLocation as resourceLocationTable } from '@ac/db';
import { eq, and } from 'drizzle-orm';
import { listResources } from '../list.remote';
import { listResourcesWithHierarchy } from '../list-with-hierarchy.remote';
import { readResource } from './read.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { updateResourceSchema } from '$lib/validations/resources';

export const updateResource = form(updateResourceSchema, async (data) => {
    console.log('--- updateResource START ---');
    console.log('Data received:', JSON.stringify(data, null, 2));

    try {
        const user = getAuthenticatedUser();
        if (!user || !user.id) {
            throw new Error('User not authenticated correctly');
        }
        ensureAccess(user, 'resources');
        console.log('User ID:', user.id);

        const maxOccupancy = (data.maxOccupancy !== undefined && data.maxOccupancy !== null && data.maxOccupancy !== '')
            ? Number(data.maxOccupancy)
            : null;

        // Manual parsing for fields simplified in schema
        let allocationCalendars = [];
        if (typeof data.allocationCalendars === 'string') {
            try { allocationCalendars = JSON.parse(data.allocationCalendars); } catch { allocationCalendars = []; }
        } else if (Array.isArray(data.allocationCalendars)) {
            allocationCalendars = data.allocationCalendars;
        }

        const updateData: any = {
            name: data.name,
            description: data.description || null,
            type: data.type,
            maxOccupancy: isNaN(maxOccupancy as any) ? null : maxOccupancy,
            locationId: (data.locationId && data.locationId !== '') ? data.locationId : null,
            allocationCalendars: allocationCalendars,
            updatedAt: new Date(),
        };

        console.log('Update payload:', JSON.stringify(updateData, null, 2));

        const updated = await db.transaction(async (tx) => {
            const result = await tx.update(resource)
                .set(updateData)
                .where(eq(resource.id, data.id))
                .returning();

            if (!result || result.length === 0) {
                throw new Error('Resource not found or update failed');
            }

            // 1. Sync parent relations
            await tx.delete(resourceRelation)
                .where(eq(resourceRelation.childResourceId, data.id));

            let parentResourceIds = [];
            if (typeof data.parentResourceIds === 'string') {
                try { parentResourceIds = JSON.parse(data.parentResourceIds); } catch { parentResourceIds = []; }
            } else if (Array.isArray(data.parentResourceIds)) {
                parentResourceIds = data.parentResourceIds;
            } else if (data.parentResourceIds) {
                parentResourceIds = [data.parentResourceIds as string];
            }

            if (parentResourceIds.length > 0) {
                const relationData = parentResourceIds.map((parentId: string) => ({
                    parentResourceId: parentId,
                    childResourceId: data.id,
                    type: 'parent-child',
                }));
                await tx.insert(resourceRelation).values(relationData);
            }

            // 2. Sync location associations
            await tx.delete(resourceLocationTable)
                .where(eq(resourceLocationTable.resourceId, data.id));

            let locationIds = [];
            if (typeof data.locationIds === 'string') {
                try { locationIds = JSON.parse(data.locationIds); } catch { locationIds = []; }
            } else if (Array.isArray(data.locationIds)) {
                locationIds = data.locationIds;
            }

            if (locationIds.length > 0) {
                const locationData = locationIds.map((locId: string) => ({
                    resourceId: data.id,
                    locationId: locId,
                }));
                await tx.insert(resourceLocationTable).values(locationData);
            }

            // 3. Sync contact associations
            const { resourceContact: resourceContactTable } = await import('@ac/db');
            await tx.delete(resourceContactTable)
                .where(eq(resourceContactTable.resourceId, data.id));

            let contactIds = [];
            if (typeof data.contactIds === 'string') {
                try { contactIds = JSON.parse(data.contactIds); } catch { contactIds = []; }
            } else if (Array.isArray(data.contactIds)) {
                contactIds = data.contactIds;
            }

            if (contactIds.length > 0) {
                const contactData = contactIds.map((cId: string) => ({
                    resourceId: data.id,
                    contactId: cId,
                }));
                await tx.insert(resourceContactTable).values(contactData);
            }

            return { updated: result[0], locationIds, contactIds, parentResourceIds };
        });

        console.log('Update success');

        console.log('Refreshing queries...');
        const updatedResource = {
            ...updated.updated,
            // Since we know the IDs from above, we can populate them without re-fetching
            parentResourceIds: updated.parentResourceIds || [],
            locationIds: updated.locationIds || [],
            contactIds: updated.contactIds || []
        };

        readResource(data.id).set(updatedResource);
        void listResources().refresh();
        void listResourcesWithHierarchy().refresh();

        console.log('--- updateResource SUCCESS ---');
        return { success: true, resource: updated };

    } catch (err: any) {
        console.error('--- updateResource ERROR ---');
        console.error(err);
        return { success: false, error: { message: err.message || 'Update failed' } };
    }
});
