import { command, query, requested } from '$app/server';
import {
    addLocationAssociation as attachLocation,
    removeLocationAssociation as detachLocation,
    fetchEntityLocations as queryEntityLocations,
} from '@ac/db';
import { locationAssociationSchema, getLocationAssociationsSchema } from '@ac/validations';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { resolveEventIdForAssociations } from '#lib/server/events/exceptions.js';
import { commitEventChange } from '#lib/server/events/sync-commit.js';

export const addLocationAssociation = command(locationAssociationSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'locations');

    const { type, entityId, locationId } = data;
    const targetEntityId =
        type === 'event' && entityId.includes('_inst_')
            ? await resolveEventIdForAssociations(entityId, { materializeIfVirtual: true, userId: user?.id })
            : entityId;

    await attachLocation({ type, entityId: targetEntityId, locationId });
    if (type === 'event') {
        await commitEventChange({
            action: 'update',
            ids: [entityId, targetEntityId],
            user,
            extraRefresh: async () => {
                try {
                    await requested(fetchEntityLocations, 20).refreshAll();
                } catch { /* ignore */ }
                await fetchEntityLocations({ type, entityId }).refresh();
            }
        });
    } else {
        try {
            await requested(fetchEntityLocations, 20).refreshAll();
        } catch { /* ignore */ }
        await fetchEntityLocations({ type, entityId }).refresh();
    }
    return { success: true };
});

export const removeLocationAssociation = command(locationAssociationSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'locations');

    const { type, entityId, locationId } = data;
    const targetEntityId =
        type === 'event' && entityId.includes('_inst_')
            ? await resolveEventIdForAssociations(entityId, { materializeIfVirtual: true, userId: user?.id })
            : entityId;

    await detachLocation({ type, entityId: targetEntityId, locationId });
    if (type === 'event') {
        await commitEventChange({
            action: 'update',
            ids: [entityId, targetEntityId],
            user,
            extraRefresh: async () => {
                try {
                    await requested(fetchEntityLocations, 20).refreshAll();
                } catch { /* ignore */ }
                await fetchEntityLocations({ type, entityId }).refresh();
            }
        });
    } else {
        try {
            await requested(fetchEntityLocations, 20).refreshAll();
        } catch { /* ignore */ }
        await fetchEntityLocations({ type, entityId }).refresh();
    }
    return { success: true };
});

export const fetchEntityLocations = query(getLocationAssociationsSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'locations');

    const { type, entityId } = data;
    const targetEntityId =
        type === 'event' && entityId.includes('_inst_')
            ? await resolveEventIdForAssociations(entityId, { materializeIfVirtual: false })
            : entityId;
    return await queryEntityLocations({ type, entityId: targetEntityId });
});
