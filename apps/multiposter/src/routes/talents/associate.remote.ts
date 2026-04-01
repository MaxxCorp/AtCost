import { command, query } from '$app/server';
import { associateTalent, dissociateTalent, getEntityTalents } from '$lib/server/talents';
import { talentAssociationSchema, getTalentAssociationsSchema } from '@ac/validations';

export const addAssociation = command(talentAssociationSchema, async (data) => {
    const { type, entityId, talentId } = data;
    await associateTalent(type as "user", entityId, talentId);
    await fetchEntityTalents({ type, entityId }).refresh();
    return { success: true };
});

export const removeAssociation = command(talentAssociationSchema, async (data) => {
    const { type, entityId, talentId } = data;
    await dissociateTalent(type as "user", entityId, talentId);
    await fetchEntityTalents({ type, entityId }).refresh();
    return { success: true };
});

export const fetchEntityTalents = query(getTalentAssociationsSchema, async (data) => {
    const { type, entityId } = data;
    const results = await getEntityTalents(type as "user", entityId);
    return results.map((r: any) => ({
        ...r,
        createdAt: r.createdAt?.toISOString(),
        updatedAt: r.updatedAt?.toISOString(),
        availabilityDate: r.availabilityDate?.toISOString(),
        contact: r.contact ? {
            ...r.contact,
            birthday: r.contact.birthday?.toISOString(),
            createdAt: r.contact.createdAt?.toISOString(),
            updatedAt: r.contact.updatedAt?.toISOString(),
        } : null
    }));
});
