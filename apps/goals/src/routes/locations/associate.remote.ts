import { command, query } from '$app/server';
import {
    db,
    goalCampaign,
    eq,
    addLocationAssociation as attachLocation,
    removeLocationAssociation as detachLocation,
    fetchEntityLocations as queryEntityLocations,
} from '@ac/db';
import { locationAssociationSchema, getLocationAssociationsSchema } from '@ac/validations';
import { getAuthenticatedUser, isOperator, ensureOperator } from '#lib/server/authorization.js';

async function assertCanManageEntityLocation(
    user: ReturnType<typeof getAuthenticatedUser>,
    type: string,
    entityId: string
) {
    if (isOperator(user)) return;

    if (type === 'goal') {
        const [campaign] = await db
            .select({ userId: goalCampaign.userId })
            .from(goalCampaign)
            .where(eq(goalCampaign.id, entityId))
            .limit(1);

        if (campaign && campaign.userId === user.id) {
            return;
        }
    }

    ensureOperator(user);
}

export const addLocationAssociation = command(locationAssociationSchema, async (data) => {
    const user = getAuthenticatedUser();
    const { type, entityId, locationId } = data;
    await assertCanManageEntityLocation(user, type, entityId);

    await attachLocation({ type, entityId, locationId });
    await fetchEntityLocations({ type, entityId }).refresh();
    return { success: true };
});

export const removeLocationAssociation = command(locationAssociationSchema, async (data) => {
    const user = getAuthenticatedUser();
    const { type, entityId, locationId } = data;
    await assertCanManageEntityLocation(user, type, entityId);

    await detachLocation({ type, entityId, locationId });
    await fetchEntityLocations({ type, entityId }).refresh();
    return { success: true };
});

export const fetchEntityLocations = query(getLocationAssociationsSchema, async (data) => {
    const { type, entityId } = data;
    return await queryEntityLocations({ type, entityId });
});
