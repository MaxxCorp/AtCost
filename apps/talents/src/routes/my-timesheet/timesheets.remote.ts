import { query, form } from '$app/server';
import { db } from '$lib/server/db';
import { timesheetEntry, timesheetAuditTrail, shiftPlan, talent, contact, userContact, userTalent, location } from '@ac/db';
import { getAuthenticatedUser, ensureAccess, getOptionalUser } from '$lib/server/authorization';
import * as service from '$lib/server/timesheets/service';
import { clockInSchema, clockOutSchema, timesheetApprovalSchema, timesheetManualUpdateSchema, shiftPlanSchema, manageTimesheetsSchema } from '@ac/validations';
import { eq, and, isNull, desc, gte, lte } from 'drizzle-orm';
import * as v from 'valibot';

async function getMyTalentIdCore() {
    const authUser = getOptionalUser();
    if (!authUser) {
        console.warn('[getMyTalentIdCore] No authenticated user found.');
        return null;
    }

    console.info(`[getMyTalentIdCore] Looking up talent ID for user: ${authUser.id}`);

    try {
        // Step 1: Check direct talent association
        const ut = await db.select({ id: userTalent.talentId }).from(userTalent).where(eq(userTalent.userId, authUser.id)).limit(1);
        if (ut[0]) {
            console.info(`[getMyTalentIdCore] Found explicit userTalent link: ${ut[0].id}`);
            return ut[0].id;
        }

        // Step 2: Get contact ID for user as fallback
        const uc = await db.select().from(userContact).where(eq(userContact.userId, authUser.id)).limit(1);
        if (!uc[0]) {
            console.warn(`[getMyTalentIdCore] No userTalent or userContact found for user: ${authUser.id}`);
            return null;
        }

        // Step 3: Get talent for that contact
        const t = await db.select({ id: talent.id }).from(talent).where(eq(talent.contactId, uc[0].contactId)).limit(1);
        const resultId = t[0]?.id || null;
        if (resultId) {
            console.info(`[getMyTalentIdCore] Found implicit talent link via contact: ${resultId}`);
        } else {
            console.warn(`[getMyTalentIdCore] Found userContact but no talent record exists for contactId: ${uc[0].contactId}`);
        }
        return resultId;
    } catch (e: any) {
        console.error('getMyTalentIdCore failed:', e);
        return null;
    }
}

export const getMyTalentId = query(v.void_(), async () => {
    return await getMyTalentIdCore();
});

export const getMyStatus = query(v.string(), async (talentId) => {
    const authUser = getAuthenticatedUser();
    
    // Allow if user has 'timesheets' claim OR if they are requesting their own talent ID
    const myTalentId = await getMyTalentIdCore();
    if (talentId !== myTalentId) {
        ensureAccess(authUser, 'timesheets');
    }
    
    // Using select instead of query helper to rule out proxy issues
    const activeEntry = await db.select().from(timesheetEntry)
        .where(and(
            eq(timesheetEntry.talentId, talentId),
            isNull(timesheetEntry.endTime)
        ))
        .limit(1);

    const recentEntries = await db.select().from(timesheetEntry)
        .where(eq(timesheetEntry.talentId, talentId))
        .orderBy(desc(timesheetEntry.startTime))
        .limit(10);

    const shiftPlans = await db.select().from(shiftPlan)
        .where(eq(shiftPlan.talentId, talentId))
        .orderBy(desc(shiftPlan.startTime))
        .limit(5);

    return {
        activeEntry: activeEntry[0] || null,
        recentEntries: recentEntries || [],
        shiftPlans: shiftPlans || []
    };
});

export const listPendingApprovals = query(v.void_(), async () => {
    ensureAccess(getAuthenticatedUser(), 'timesheets');
    return await db.query.timesheetEntry.findMany({
        where: eq(timesheetEntry.status, 'pending'),
        with: {
            talent: {
                with: {
                    contact: true
                }
            }
        },
        orderBy: [desc(timesheetEntry.startTime)]
    });
});

export const manageTimesheets = form(manageTimesheetsSchema, async (data) => {
    try {
        const authUser = getAuthenticatedUser();
        const myTalentId = await getMyTalentIdCore();
        
        // Authorization check
        if ('talentId' in data && data.talentId !== myTalentId) {
            ensureAccess(authUser, 'timesheets');
        } else if (!('talentId' in data)) {
            // Actions without talentId (approve/reject) require 'timesheets' claim
            ensureAccess(authUser, 'timesheets');
        }

        let entry;
        switch (data.action) {
            case 'clock_in':
                entry = await service.clockIn(data, authUser.id);
                break;
            case 'clock_out':
                entry = await service.clockOut(data.entryId, authUser.id, { latitude: data.latitude, longitude: data.longitude });
                break;
            case 'approve':
                entry = await service.approveEntry(data.entryId, authUser.id, (data as any).comment);
                break;
            case 'reject':
                entry = await service.rejectEntry(data.entryId, authUser.id, (data as any).comment);
                break;
        }

        // Sanitize entry to plain JSON object to avoid serialization issues with Dates/complex objects
        const sanitizedEntry = entry ? JSON.parse(JSON.stringify(entry)) : null;

        return { success: true, entry: sanitizedEntry };
    } catch (e: any) {
        console.error('[manageTimesheets] Error:', e);
        return { 
            success: false, 
            error: { message: e.message || 'Action failed at source' },
            message: e.message || 'Action failed at source' 
        };
    }
});
