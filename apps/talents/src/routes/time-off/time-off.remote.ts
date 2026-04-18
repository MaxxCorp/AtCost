import { query, form } from '$app/server';
import { db, timeOffRequest, timeOffBalance, talent, eq, and, desc } from '$lib/server/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { timeOffRequestSchema } from '@ac/validations';
import * as v from 'valibot';

/**
 * CORE LOGIC - EXPOSED FOR SERVER LOAD
 */

async function getMyTimeOffBalancesCore(talentId: string) {
    const currentYear = new Date().getFullYear();
    return await db.query.timeOffBalance.findMany({
        where: and(
            eq(timeOffBalance.talentId, talentId),
            eq(timeOffBalance.year, currentYear)
        ) as any
    });
}

async function getMyTimeOffRequestsCore(talentId: string) {
    return await db.query.timeOffRequest.findMany({
        where: eq(timeOffRequest.talentId, talentId) as any,
        orderBy: [desc(timeOffRequest.startDate) as any],
        limit: 5
    });
}

/**
 * REMOTE FUNCTIONS
 */

export const getMyTimeOffBalances = query(v.string(), async (talentId) => {
    ensureAccess(getAuthenticatedUser(), 'timesheets');
    return await getMyTimeOffBalancesCore(talentId);
});

export const getMyTimeOffRequests = query(v.string(), async (talentId) => {
    ensureAccess(getAuthenticatedUser(), 'timesheets');
    return await getMyTimeOffRequestsCore(talentId);
});

export const requestTimeOff = form(timeOffRequestSchema, async (data) => {
    ensureAccess(getAuthenticatedUser(), 'timesheets');
    
    // In a real app, we'd check balances here
    const [newRequest] = await db.insert(timeOffRequest).values({
        talentId: data.talentId,
        type: data.type,
        status: 'pending',
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reason: data.reason
    }).returning();

    // Update pending days in balance
    const currentYear = new Date().getFullYear();
    const days = Math.ceil((new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    const balance = await db.query.timeOffBalance.findFirst({
        where: and(
            eq(timeOffBalance.talentId, data.talentId),
            eq(timeOffBalance.year, currentYear)
        ) as any
    });

    if (balance) {
        await db.update(timeOffBalance).set({
            pendingDays: (balance.pendingDays || 0) + days
        }).where(eq(timeOffBalance.id, balance.id) as any);
    } else {
        await db.insert(timeOffBalance).values({
            talentId: data.talentId,
            year: currentYear,
            totalDays: 25, // Default
            pendingDays: days,
            usedDays: 0
        });
    }

    return { success: true, request: newRequest };
});
