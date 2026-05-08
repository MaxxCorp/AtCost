import { command, query } from '$app/server';
import { db } from '@ac/db';
import { talent, userTalent } from '@ac/db';
import { eq } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { talentAssociationSchema, getTalentAssociationsSchema } from '@ac/validations';
import { addAssociation as dbAddAssociation, removeAssociation as dbRemoveAssociation } from '$lib/server/associations';

const tableMap = {
    user: userTalent
} as const;

const fieldMap = {
    user: 'userId'
} as const;

export const addAssociation = command(talentAssociationSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const { type, entityId, talentId } = data;
    
    await dbAddAssociation({
        type,
        entityId,
        itemId: talentId,
        tableMap,
        fieldMap,
        itemField: 'talentId'
    });
    
    await fetchEntityTalents({ type, entityId }).refresh();
    return { success: true };
});

export const removeAssociation = command(talentAssociationSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const { type, entityId, talentId } = data;
    
    await dbRemoveAssociation({
        type,
        entityId,
        itemId: talentId,
        tableMap,
        fieldMap,
        itemField: 'talentId'
    });
    
    await fetchEntityTalents({ type, entityId }).refresh();
    return { success: true };
});

export const fetchEntityTalents = query(getTalentAssociationsSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const { type, entityId } = data;
    
    const table = tableMap[type as keyof typeof tableMap];
    const entityField = fieldMap[type as keyof typeof fieldMap];

    if (!table || !entityField) {
        return [];
    }

    const results = await db.query.userTalent.findMany({
        where: (table: any, { eq }: any) => eq(table.userId, entityId),
        with: {
            talent: {
                with: {
                    contact: {
                        with: {
                            emails: true,
                            phones: true
                        }
                    }
                }
            }
        }
    });
    
    return results.map((r: any) => {
        const t = r.talent;
        return {
            ...t,
            createdAt: t.createdAt?.toISOString(),
            updatedAt: t.updatedAt?.toISOString(),
            availabilityDate: t.availabilityDate?.toISOString(),
            contact: t.contact ? {
                ...t.contact,
                birthday: t.contact.birthday?.toISOString(),
                createdAt: t.contact.createdAt?.toISOString(),
                updatedAt: t.contact.updatedAt?.toISOString(),
            } : null
        };
    });
});
