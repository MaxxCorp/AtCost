import { query } from '$app/server';
import { db, shiftPlanTemplateTalent, talent, contact, contactEmail } from '$lib/server/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { eq, and } from '$lib/server/db';
import * as v from 'valibot';

const entityArgs = v.object({ 
    type: v.string(), 
    entityId: v.string() 
});

const associationArgs = v.object({ 
    type: v.string(), 
    entityId: v.string(),
    itemId: v.string()
});

export const fetchEntityTalents = query(entityArgs, async ({ entityId }): Promise<any[]> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'shiftplans');
    
    const results = await db
        .select({
            id: talent.id,
            jobTitle: talent.jobTitle,
            displayName: contact.displayName,
            email: contactEmail.value,
        })
        .from(shiftPlanTemplateTalent)
        .innerJoin(talent, eq(shiftPlanTemplateTalent.talentId, talent.id) as any)
        .innerJoin(contact, eq(talent.contactId, contact.id) as any)
        .leftJoin(contactEmail, and(
            eq(contact.id, contactEmail.contactId),
            eq(contactEmail.primary, true)
        ) as any)
        .where(eq(shiftPlanTemplateTalent.templateId, entityId) as any);
        
    return results.map(r => ({ 
        ...r, 
        contact: { displayName: r.displayName, email: r.email },
        label: r.displayName || r.email || 'Staff Member'
    }));
});

export const addAssociation = query(associationArgs, async ({ entityId, itemId }): Promise<{ success: boolean }> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'shiftplans');
    
    await db.insert(shiftPlanTemplateTalent).values({
        templateId: entityId,
        talentId: itemId,
    } as any).onConflictDoNothing();
    return { success: true };
});

export const removeAssociation = query(associationArgs, async ({ entityId, itemId }): Promise<{ success: boolean }> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'shiftplans');
    
    await db.delete(shiftPlanTemplateTalent).where(
        and(
            eq(shiftPlanTemplateTalent.templateId, entityId),
            eq(shiftPlanTemplateTalent.talentId, itemId)
        ) as any
    );
    return { success: true };
});

export const fetchTalentTimeOff = query(v.array(v.string()), async (talentIds): Promise<any[]> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'shiftplans');
    
    if (!talentIds.length) return [];
    
    const now = new Date();
    
    return await db.query.timeOffRequest.findMany({
        where: (tor: any, { inArray, and, gt }: any) => and(
            inArray(tor.talentId, talentIds),
            gt(tor.endDate, now)
        ) as any
    }) as any[];
});
