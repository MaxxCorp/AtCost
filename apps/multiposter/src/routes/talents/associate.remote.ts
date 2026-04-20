import { command, query } from '$app/server';
import { db } from '$lib/server/db';
import { talent, userTalent } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { talentAssociationSchema, getTalentAssociationsSchema } from '@ac/validations';

export const addAssociation = command(talentAssociationSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const { type, entityId, talentId } = data;
    if (type === "user") {
        await db.insert(userTalent).values({
            userId: entityId,
            talentId: talentId
        }).onConflictDoNothing();
    }
    
    await fetchEntityTalents({ type, entityId }).refresh();
    return { success: true };
});

export const removeAssociation = command(talentAssociationSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const { type, entityId, talentId } = data;
    if (type === "user") {
        await db.delete(userTalent).where(
            and(
                eq(userTalent.userId, entityId),
                eq(userTalent.talentId, talentId)
            )
        );
    }
    
    await fetchEntityTalents({ type, entityId }).refresh();
    return { success: true };
});

export const fetchEntityTalents = query(getTalentAssociationsSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    const { type, entityId } = data;
    if (type === "user") {
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
    }
    return [];
});
