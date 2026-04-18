import { query, form, command } from '$app/server';
import { db, timesheetEntry, shiftPlan, eq, and, isNull, desc } from '$lib/server/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as service from '$lib/server/timesheets/service';
import { manageTimesheetsSchema } from '@ac/validations';
import * as v from 'valibot';

export const getMyTalentId = query(v.undefined_(), async (): Promise<string | null> => {
    return await service.getMyTalentIdCore();
});

export const getMyStatus = query(v.string(), async (talentId): Promise<{ activeEntry: any; recentEntries: any[]; shiftPlans: any[] }> => {
    const authUser = getAuthenticatedUser();
    
    // Allow if user has 'timesheets' claim OR if they are requesting their own talent ID
    const myTalentId = await service.getMyTalentIdCore();
    if (talentId !== myTalentId) {
        ensureAccess(authUser, 'timesheets');
    }
    
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

export const listPendingApprovals = query(v.undefined_(), async (): Promise<any[]> => {
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
    }) as any[];
});

const manageTimesheetsHandler = async (data: v.InferInput<typeof manageTimesheetsSchema>): Promise<{ success: boolean; entry?: any; error?: { message: string }; message?: string }> => {
    try {
        const authUser = getAuthenticatedUser();
        const myTalentId = await service.getMyTalentIdCore();
        
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
                entry = await service.clockIn({
                    ...data,
                    startTime: data.startTime ? new Date(data.startTime) : undefined
                }, authUser.id);
                break;
            case 'clock_out':
                entry = await service.clockOut(data.entryId, authUser.id, { 
                    latitude: data.latitude, 
                    longitude: data.longitude,
                    endTime: data.endTime ? new Date(data.endTime) : undefined
                });
                break;
            case 'approve':
                entry = await service.approveEntry(data.entryId, authUser.id, (data as any).comment);
                break;
            case 'reject':
                entry = await service.rejectEntry(data.entryId, authUser.id, (data as any).comment);
                break;
        }

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
};

export const manageTimesheets = form(manageTimesheetsSchema, manageTimesheetsHandler);
export const invokeManageTimesheets = command(manageTimesheetsSchema, manageTimesheetsHandler);

