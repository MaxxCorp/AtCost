import { query, form } from '$app/server';
import { db, timeOffRequest, timeOffBalance, talent, eq, and, desc, or, ilike, sql } from '$lib/server/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { timeOffRequestSchema, type PaginatedResult } from '@ac/validations';

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

import { timeOffPaginationSchema as PaginationSchema } from '@ac/validations';


export const listTimeOffRequests = query(PaginationSchema, async (input): Promise<PaginatedResult<any>> => {

    const user = getAuthenticatedUser();
    ensureAccess(user, 'timesheets');

    const { page = 1, limit = 50, search = '', talentId } = input || {};
    const offset = (page - 1) * limit;
    
    const { contact } = await import('@ac/db');

    let baseQuery = db.select({
        id: timeOffRequest.id,
        type: timeOffRequest.type,
        status: timeOffRequest.status,
        startDate: timeOffRequest.startDate,
        endDate: timeOffRequest.endDate,
        reason: timeOffRequest.reason,
        talentId: timeOffRequest.talentId,
        talentName: contact.displayName,
    }).from(timeOffRequest)
    .leftJoin(talent, eq(timeOffRequest.talentId, talent.id) as any)
    .leftJoin(contact, eq(talent.contactId, contact.id) as any)
    .$dynamic();
    
    const conditions = [];
    if (talentId) {
        const { inArray } = await import('drizzle-orm');
        const ids = Array.isArray(talentId) ? talentId : [talentId];
        conditions.push(inArray(timeOffRequest.talentId, ids));
    }
    
    if (search) {
        const { or, ilike } = await import('drizzle-orm');
        conditions.push(or(
            ilike(timeOffRequest.reason as any, `%${search}%`),
            ilike(timeOffRequest.type as any, `%${search}%`),
            ilike(contact.displayName, `%${search}%`)
        ));
    }

    if (conditions.length > 0) {
        const { and } = await import('drizzle-orm');
        baseQuery = baseQuery.where(and(...conditions as any)) as any;
    }

    const { sql, desc } = await import('drizzle-orm');
    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult[0]?.count || 0);

    const data = await baseQuery
        .orderBy(desc(timeOffRequest.startDate) as any)
        .limit(limit)
        .offset(offset);

    return { data, total };
});

export const getMyTimeOffRequests = query(v.string(), async (talentId) => {
    ensureAccess(getAuthenticatedUser(), 'timesheets');
    return await getMyTimeOffRequestsCore(talentId);
});

export const getMyTimeOffBalances = query(v.string(), async (talentId) => {
    ensureAccess(getAuthenticatedUser(), 'timesheets');
    return await getMyTimeOffBalancesCore(talentId);
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
