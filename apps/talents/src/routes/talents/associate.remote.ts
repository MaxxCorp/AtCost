import { command, query } from '$app/server';
import { userTalent, userContact, talent } from '@ac/db';
import { db } from '$lib/server/db';
import { eq, and, inArray } from 'drizzle-orm';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { talentAssociationSchema, getTalentAssociationsSchema } from '@ac/validations';

export const addAssociation = command(talentAssociationSchema, async (data) => {
    const authUser = getAuthenticatedUser();
    ensureAccess(authUser, 'talents');

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
    const authUser = getAuthenticatedUser();
    ensureAccess(authUser, 'talents');

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
    const authUser = getAuthenticatedUser();
    ensureAccess(authUser, 'talents');

    const { type, entityId } = data;
    if (type === "user") {
        // 1. Get explicit associations
        const explicitAssociations = await db.select().from(userTalent).where(eq(userTalent.userId, entityId));
        
        // 2. Get talents linked via user_contact (for talents "Linked" to an account)
        const contactLinks = await db.select().from(userContact).where(eq(userContact.userId, entityId));
        
        const talentIds = new Set(explicitAssociations.map(a => a.talentId));
        
        if (contactLinks.length > 0) {
            const linkedTalents = await db.select({ id: talent.id })
                .from(talent)
                .where(inArray(talent.contactId, contactLinks.map(c => c.contactId)));
            
            for (const t of linkedTalents) {
                talentIds.add(t.id);
            }
        }

        if (talentIds.size === 0) return [];

        const results = await db.query.talent.findMany({
            where: inArray(talent.id, Array.from(talentIds)),
            with: {
                contact: {
                    with: {
                        emails: true,
                        phones: true
                    }
                }
            }
        });
        
        return results.map(t => {
            if (!t) return null;
            return {
                ...(t as any),
                createdAt: t.createdAt?.toISOString?.() ?? (t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt),
                updatedAt: t.updatedAt?.toISOString?.() ?? (t.updatedAt instanceof Date ? t.updatedAt.toISOString() : t.updatedAt),
                availabilityDate: t.availabilityDate?.toISOString?.() ?? (t.availabilityDate instanceof Date ? t.availabilityDate.toISOString() : t.availabilityDate),
                contact: t.contact ? {
                    ...(t.contact as any),
                    birthday: t.contact.birthday?.toISOString?.() ?? (t.contact.birthday instanceof Date ? t.contact.birthday.toISOString() : t.contact.birthday),
                    createdAt: t.contact.createdAt?.toISOString?.() ?? (t.contact.createdAt instanceof Date ? t.contact.createdAt.toISOString() : t.contact.createdAt),
                    updatedAt: t.contact.updatedAt?.toISOString?.() ?? (t.contact.updatedAt instanceof Date ? t.contact.updatedAt.toISOString() : t.contact.updatedAt),
                } : null
            };
        }).filter(Boolean);
    }
    return [];
});
