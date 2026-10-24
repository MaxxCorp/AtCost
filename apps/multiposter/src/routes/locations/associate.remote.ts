import { command, query, requested } from '$app/server';
import {
    addLocationAssociation as attachLocation,
    removeLocationAssociation as detachLocation,
    fetchEntityLocations as queryEntityLocations,
} from '@ac/db';
import { locationAssociationSchema, getLocationAssociationsSchema } from '@ac/validations';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { invalidateEvent } from '#lib/server/cache/index.js';
import { readEvent } from '../events/[id]/read.remote.js';

export const addLocationAssociation = command(locationAssociationSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'locations');

    const { type, entityId, locationId } = data;
    await attachLocation({ type, entityId, locationId });
    if (type === 'event') {
        await invalidateEvent(entityId);
        void readEvent(entityId).refresh();
    }
    try {
        await requested(fetchEntityLocations, 20).refreshAll();
    } catch { /* ignore */ }
    await fetchEntityLocations({ type, entityId }).refresh();
    return { success: true };
});

export const removeLocationAssociation = command(locationAssociationSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'locations');

    const { type, entityId, locationId } = data;
    await detachLocation({ type, entityId, locationId });
    if (type === 'event') {
        await invalidateEvent(entityId);
        void readEvent(entityId).refresh();
    }
    try {
        await requested(fetchEntityLocations, 20).refreshAll();
    } catch { /* ignore */ }
    await fetchEntityLocations({ type, entityId }).refresh();
    return { success: true };
});

export const fetchEntityLocations = query(getLocationAssociationsSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'locations');

    const { type, entityId } = data;
    return await queryEntityLocations({ type, entityId });
});
