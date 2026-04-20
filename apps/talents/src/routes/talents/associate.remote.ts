import { command, query } from '$app/server';
import { db, userTalent, userContact, talent, locationContact, eq, and, inArray } from '$lib/server/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { talentAssociationSchema, getTalentAssociationsSchema } from '@ac/validations';

export const associateTalent = command(talentAssociationSchema, async (data): Promise<{ success: boolean }> => {
    const authUser = getAuthenticatedUser();
    ensureAccess(authUser, 'talents');

    const { type, entityId, talentId } = data;
    if (type === "user") {
        await db.insert(userTalent).values({
            userId: entityId,
            talentId: talentId
        } as any).onConflictDoNothing();
    } else if (type === "location") {
        const t = await db.query.talent.findFirst({ where: eq(talent.id, talentId) });
        if (t) {
            await db.insert(locationContact).values({
                locationId: entityId,
                contactId: t.contactId
            } as any).onConflictDoNothing();
        }
    }
    
    return { success: true };
});

export const dissociateTalent = command(talentAssociationSchema, async (data): Promise<{ success: boolean }> => {
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
    } else if (type === "location") {
        const t = await db.query.talent.findFirst({ where: eq(talent.id, talentId) });
        if (t) {
            await db.delete(locationContact).where(
                and(
                    eq(locationContact.locationId, entityId),
                    eq(locationContact.contactId, t.contactId)
                ) as any
            );
        }
    }
    
    return { success: true };
});

export const getEntityTalents = query(getTalentAssociationsSchema, async (data): Promise<any[]> => {
    const authUser = getAuthenticatedUser();
    ensureAccess(authUser, 'talents');

    const { type, entityId } = data;
    const talentIds = new Set<string>();

    if (type === "user") {
        // 1. Get explicit associations
        const explicitAssociations = await db.select().from(userTalent).where(eq(userTalent.userId, entityId));
        for (const a of explicitAssociations) talentIds.add(a.talentId);
        
        // 2. Get talents linked via user_contact (for talents "Linked" to an account)
        const contactLinks = await db.select().from(userContact).where(eq(userContact.userId, entityId));
        if (contactLinks.length > 0) {
            const linkedTalents = await db.select({ id: talent.id })
                .from(talent)
                .where(inArray(talent.contactId, contactLinks.map(c => c.contactId)));
            
            for (const t of linkedTalents) {
                talentIds.add(t.id);
            }
        }
    } else if (type === "location") {
        const associations = await db.select().from(locationContact).where(eq(locationContact.locationId, entityId));
        if (associations.length > 0) {
            const linkedTalents = await db.select({ id: talent.id })
                .from(talent)
                .where(inArray(talent.contactId, associations.map(a => a.contactId)));
            for (const t of linkedTalents) talentIds.add(t.id);
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
            ...t,
            createdAt: t.createdAt?.toISOString?.() ?? (t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt),
            updatedAt: t.updatedAt?.toISOString?.() ?? (t.updatedAt instanceof Date ? t.updatedAt.toISOString() : t.updatedAt),
            availabilityDate: t.availabilityDate?.toISOString?.() ?? (t.availabilityDate instanceof Date ? t.availabilityDate.toISOString() : t.availabilityDate),
            contact: t.contact ? {
                ...t.contact,
                birthday: t.contact.birthday?.toISOString?.() ?? (t.contact.birthday instanceof Date ? t.contact.birthday.toISOString() : t.contact.birthday),
                createdAt: t.contact.createdAt?.toISOString?.() ?? (t.contact.createdAt instanceof Date ? t.contact.createdAt.toISOString() : t.contact.createdAt),
                updatedAt: t.updatedAt?.toISOString?.() ?? (t.updatedAt instanceof Date ? t.updatedAt.toISOString() : t.updatedAt),
            } : null
        };
    }).filter(Boolean);
});

