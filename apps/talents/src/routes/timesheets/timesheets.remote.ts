import { query, form } from '$app/server';
import { db } from '$lib/server/db';
import { timesheetEntry, timesheetAuditTrail, shiftPlan, talent, contact, userContact } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as service from '$lib/server/timesheets/service';
import { clockInSchema, clockOutSchema, timesheetApprovalSchema, timesheetManualUpdateSchema, shiftPlanSchema } from '@ac/validations';
import { eq, and, isNull, desc, gte, lte } from 'drizzle-orm';
import * as v from 'valibot';

export const getMyTalentId = query(v.void_(), async () => {
    const authUser = getAuthenticatedUser();
    if (!authUser) return null;

    try {
        // Step 1: Get contact ID for user
        const uc = await db.select().from(userContact).where(eq(userContact.userId, authUser.id)).limit(1);
        if (!uc[0]) return null;

        // Step 2: Get talent for that contact
        const t = await db.select({ id: talent.id }).from(talent).where(eq(talent.contactId, uc[0].contactId)).limit(1);
        return t[0]?.id || null;
    } catch (e: any) {
        console.error('getMyTalentId failed:', e);
        throw e;
    }
});

export const getMyStatus = query(v.string(), async (talentId) => {
    ensureAccess(getAuthenticatedUser(), 'timesheets');
    
    const activeEntry = await db.query.timesheetEntry.findFirst({
        where: and(
            eq(timesheetEntry.talentId, talentId),
            isNull(timesheetEntry.endTime)
        ),
        with: {
            location: true,
            shiftPlan: true
        }
    });

    const recentEntries = await db.query.timesheetEntry.findMany({
        where: eq(timesheetEntry.talentId, talentId),
        orderBy: [desc(timesheetEntry.startTime)],
        limit: 10,
        with: {
            location: true,
            shiftPlan: true
        }
    });

    const shiftPlans = await db.query.shiftPlan.findMany({
        where: eq(shiftPlan.talentId, talentId),
        orderBy: [desc(shiftPlan.startTime)],
        limit: 5
    });

    return {
        activeEntry,
        recentEntries,
        shiftPlans
    };
});

export const clockIn = form(clockInSchema, async (data) => {
    ensureAccess(getAuthenticatedUser(), 'timesheets');
    const entry = await service.clockIn(data);
    await getMyStatus(data.talentId).refresh();
    return { success: true, entry };
});

export const clockOut = form(clockOutSchema, async (data) => {
    ensureAccess(getAuthenticatedUser(), 'timesheets');
    const entry = await service.clockOut(data.entryId, data.talentId, { latitude: data.latitude, longitude: data.longitude });
    await getMyStatus(data.talentId).refresh();
    return { success: true, entry };
});

export const listPendingApprovals = query(v.void_(), async () => {
    ensureAccess(getAuthenticatedUser(), 'timesheets');
    // In a real app we'd filter by manager's team
    return await db.query.timesheetEntry.findMany({
        where: eq(timesheetEntry.status, 'pending'),
        with: {
            talent: {
                with: { contact: true }
            },
            location: true,
            shiftPlan: true
        },
        orderBy: [desc(timesheetEntry.startTime)]
    });
});

export const approveEntry = form(timesheetApprovalSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'timesheets');
    await service.approveEntry(data.entryId, user.id, data.comment);
    await listPendingApprovals().refresh();
    return { success: true };
});

export const rejectEntry = form(timesheetApprovalSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'timesheets');
    await service.rejectEntry(data.entryId, user.id, data.comment);
    await listPendingApprovals().refresh();
    return { success: true };
});

export const getAuditTrail = query(v.string(), async (entryId) => {
    ensureAccess(getAuthenticatedUser(), 'timesheets');
    return await db.query.timesheetAuditTrail.findMany({
        where: eq(timesheetAuditTrail.timesheetEntryId, entryId),
        with: {
            changedByUser: true
        },
        orderBy: [desc(timesheetAuditTrail.timestamp)]
    });
});

export const createShiftPlan = form(shiftPlanSchema, async (data) => {
    ensureAccess(getAuthenticatedUser(), 'timesheets');
    const [newShift] = await db.insert(shiftPlan).values({
        talentId: data.talentId,
        locationId: data.locationId,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        notes: data.notes
    }).returning();
    return { success: true, shift: newShift };
});
