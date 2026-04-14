import { query } from '$app/server';
import { db } from '$lib/server/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { shiftPlanTemplateTalent, talent, contact, contactEmail, timeOffRequest } from '@ac/db/schema';
import { eq, and } from 'drizzle-orm';
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

export const fetchEntityTalents = query(entityArgs, async ({ entityId }) => {
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
        .innerJoin(talent, eq(shiftPlanTemplateTalent.talentId, talent.id))
        .innerJoin(contact, eq(talent.contactId, contact.id))
        .leftJoin(contactEmail, and(
            eq(contact.id, contactEmail.contactId),
            eq(contactEmail.primary, true)
        ))
        .where(eq(shiftPlanTemplateTalent.templateId, entityId));
        
    return results.map(r => ({ 
        ...r, 
        contact: { displayName: r.displayName, email: r.email },
        label: r.displayName || r.email || 'Staff Member'
    }));
});

export const addAssociation = query(associationArgs, async ({ entityId, itemId }) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'shiftplans');
    
    await db.insert(shiftPlanTemplateTalent).values({
        templateId: entityId,
        talentId: itemId,
    }).onConflictDoNothing();
    return { success: true };
});

export const removeAssociation = query(associationArgs, async ({ entityId, itemId }) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'shiftplans');
    
    await db.delete(shiftPlanTemplateTalent).where(
        and(
            eq(shiftPlanTemplateTalent.templateId, entityId),
            eq(shiftPlanTemplateTalent.talentId, itemId)
        )
    );
    return { success: true };
});

export const fetchTalentTimeOff = query(v.array(v.string()), async (talentIds) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'shiftplans');
    
    if (!talentIds.length) return [];
    
    const now = new Date();
    
    const results = await db.query.timeOffRequest.findMany({
        where: (tor, { inArray, and, gt }) => and(
            inArray(tor.talentId, talentIds),
            gt(tor.endDate, now)
        )
    });
    
    return results;
});
