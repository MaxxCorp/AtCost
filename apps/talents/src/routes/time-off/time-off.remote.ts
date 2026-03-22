import { query, form } from '$app/server';
import { db } from '$lib/server/db';
import { timeOffRequest, timeOffBalance, talent } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { timeOffRequestSchema } from '@ac/validations';
import { eq, and, desc } from 'drizzle-orm';
import * as v from 'valibot';

export const getMyTimeOffBalances = query(v.string(), async (talentId) => {
    ensureAccess(getAuthenticatedUser(), 'timesheets');
    const currentYear = new Date().getFullYear();
    return await db.query.timeOffBalance.findMany({
        where: and(
            eq(timeOffBalance.talentId, talentId),
            eq(timeOffBalance.year, currentYear)
        )
    });
});

export const getMyTimeOffRequests = query(v.string(), async (talentId) => {
    ensureAccess(getAuthenticatedUser(), 'timesheets');
    return await db.query.timeOffRequest.findMany({
        where: eq(timeOffRequest.talentId, talentId),
        orderBy: [desc(timeOffRequest.startDate)],
        limit: 5
    });
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
        )
    });

    if (balance) {
        await db.update(timeOffBalance).set({
            pendingDays: (balance.pendingDays || 0) + days
        }).where(eq(timeOffBalance.id, balance.id));
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
