import { query, form, command } from '$app/server';
import { 
    db, timeOffRequest, timeOffBalance, talent, contract,
    unionContractCondition, contactTag, talentTag, tag, locationContact,
    eq, and, desc, asc, or, ilike, sql, inArray, notInArray, not, exists
} from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { 
    timeOffRequestSchema, 
    parseFilterValue, 
    reviewTimeOffSchema,
    talentAbsenceAwarenessInputSchema,
    teamSurroundingAbsencesInputSchema,
    type PaginatedResult 
} from '@ac/validations';
import { calculateAbsenceDays, getPublicHolidays, type AbsenceCalculationResult } from '#lib/utils/holidays.js';
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
        )
    });
}

async function getMyTimeOffRequestsCore(talentId: string) {
    return await db.query.timeOffRequest.findMany({
        where: eq(timeOffRequest.talentId, talentId),
        orderBy: [desc(timeOffRequest.startDate)],
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

    const { page = 1, limit = 50, search = '', talentId, status, type } = input || {};
    const offset = (page - 1) * limit;
    
    const { contact } = await import('@ac/db');

    let baseQuery = db.select({
        id: timeOffRequest.id,
        type: timeOffRequest.type,
        status: timeOffRequest.status,
        startDate: timeOffRequest.startDate,
        endDate: timeOffRequest.endDate,
        reason: timeOffRequest.reason,
        managerId: timeOffRequest.managerId,
        managerComment: timeOffRequest.managerComment,
        talentId: timeOffRequest.talentId,
        talentName: contact.displayName,
    }).from(timeOffRequest)
    .leftJoin(talent, eq(timeOffRequest.talentId, talent.id))
    .leftJoin(contact, eq(talent.contactId, contact.id))
    .$dynamic();
    
    const conditions = [];
    if (talentId) {
        const { include, exclude } = parseFilterValue(talentId);
        if (include.length > 0) {
            conditions.push(inArray(timeOffRequest.talentId, include));
        }
        if (exclude.length > 0) {
            conditions.push(notInArray(timeOffRequest.talentId, exclude));
        }
    }

    if (status) {
        const { include, exclude } = parseFilterValue(status);
        if (include.length > 0) {
            conditions.push(inArray(timeOffRequest.status, include as any));
        }
        if (exclude.length > 0) {
            conditions.push(notInArray(timeOffRequest.status, exclude as any));
        }
    }

    if (type) {
        const { include, exclude } = parseFilterValue(type);
        if (include.length > 0) {
            conditions.push(inArray(timeOffRequest.type, include as any));
        }
        if (exclude.length > 0) {
            conditions.push(notInArray(timeOffRequest.type, exclude as any));
        }
    }
    
    if (search) {
        conditions.push(or(
            ilike(timeOffRequest.reason, `%${search}%`),
            ilike(timeOffRequest.type, `%${search}%`),
            ilike(contact.displayName, `%${search}%`)
        ));
    }

    if (conditions.length > 0) {
        baseQuery = baseQuery.where(and(...conditions));
    }

    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult[0]?.count || 0);

    const data = await baseQuery
        .orderBy(desc(timeOffRequest.startDate))
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
    
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    const [newRequest] = await db.insert(timeOffRequest).values({
        talentId: data.talentId,
        type: data.type,
        status: 'pending',
        startDate,
        endDate,
        reason: data.reason
    }).returning();

    // Calculate actual working days excluding public holidays and weekends
    const workingDays = calculateAbsenceDays(startDate, endDate).workingDays;
    const currentYear = startDate.getFullYear();
    
    const balance = await db.query.timeOffBalance.findFirst({
        where: and(
            eq(timeOffBalance.talentId, data.talentId),
            eq(timeOffBalance.year, currentYear)
        )
    });

    if (balance) {
        await db.update(timeOffBalance).set({
            pendingDays: (balance.pendingDays || 0) + workingDays,
            updatedAt: new Date()
        }).where(eq(timeOffBalance.id, balance.id));
    } else {
        await db.insert(timeOffBalance).values({
            talentId: data.talentId,
            year: currentYear,
            totalDays: 25, // Default
            pendingDays: workingDays,
            usedDays: 0
        });
    }

    void listTimeOffRequests().refresh();
    void listTimeOffRequests({}).refresh();
    void getMyTimeOffRequests(data.talentId).refresh();
    void getMyTimeOffBalances(data.talentId).refresh();

    return { success: true, request: newRequest };
});

export const deleteTimeOffRequests = command(v.array(v.string()), async (ids) => {
    ensureAccess(getAuthenticatedUser(), 'timesheets');
    if (!ids || ids.length === 0) return { success: true };
    await db.delete(timeOffRequest).where(inArray(timeOffRequest.id, ids));
    void listTimeOffRequests().refresh();
    void listTimeOffRequests({}).refresh();
    return { success: true };
});

/**
 * Situational Awareness: Comprehensive Talent Absence & Allotment Context
 */
export const getTalentAbsenceAwareness = query(talentAbsenceAwarenessInputSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'timesheets');

    const { talentId, startDate, endDate, currentRequestId } = input;

    // 1. Fetch talent with contact, tags, contracts, balances, requests
    const talentRecord = await db.query.talent.findFirst({
        where: eq(talent.id, talentId),
        with: {
            contact: {
                with: {
                    tags: { with: { tag: true } }
                }
            },
            tags: { with: { tag: true } },
            contracts: {
                orderBy: [desc(contract.createdAt)],
                limit: 1,
                with: {
                    frameworks: { with: { framework: true } }
                }
            },
            timeOffBalances: true,
            timeOffRequests: {
                orderBy: [desc(timeOffRequest.startDate)]
            }
        }
    });

    if (!talentRecord) {
        throw new Error('Talent profile not found');
    }

    // Resolve tags from both talent.tags and talent.contact.tags
    const tagMap = new Map<string, { id: string; name: string; color: string }>();
    if (talentRecord.contact?.tags) {
        for (const ct of talentRecord.contact.tags) {
            if (ct.tag) tagMap.set(ct.tag.id, { id: ct.tag.id, name: ct.tag.name, color: (ct.tag as any).color || 'indigo' });
        }
    }
    if (talentRecord.tags) {
        for (const tt of talentRecord.tags) {
            if (tt.tag) tagMap.set(tt.tag.id, { id: tt.tag.id, name: tt.tag.name, color: (tt.tag as any).color || 'indigo' });
        }
    }
    const tags = Array.from(tagMap.values());

    const activeContract = talentRecord.contracts?.[0] || null;

    // Check union contract condition for tenure benefits if framework is linked
    let tenureSpecialLeaveDays = 0;
    if (activeContract?.frameworks?.[0]?.frameworkId) {
        const cond = await db.query.unionContractCondition.findFirst({
            where: and(
                eq(unionContractCondition.frameworkId, activeContract.frameworks[0].frameworkId),
                eq(unionContractCondition.status, 'approved')
            )
        });
        if (cond?.tenureBenefits && Array.isArray(cond.tenureBenefits)) {
            for (const tb of cond.tenureBenefits) {
                if (tb.specialLeaveDays) {
                    tenureSpecialLeaveDays = Math.max(tenureSpecialLeaveDays, tb.specialLeaveDays);
                }
            }
        }
    }

    // 2. Allotment calculations & sources
    const currentYear = new Date().getFullYear();
    const balance = talentRecord.timeOffBalances?.find((b: any) => b.year === currentYear) || {
        totalDays: activeContract?.holidayAllotmentDays ?? 25,
        usedDays: 0,
        pendingDays: 0
    };

    const remainingDays = Math.max(0, balance.totalDays - (balance.usedDays || 0) - (balance.pendingDays || 0));

    const allotmentSources = [
        {
            source: "Contractual Annual Leave",
            days: activeContract?.holidayAllotmentDays ?? balance.totalDays,
            type: "vacation",
            description: activeContract?.wageTable ? `Tariff / Contract: ${activeContract.wageTable}` : "Standard Employment Contract",
        },
        ...(activeContract?.specialLeaveDays ? [{
            source: "Special / Educational Leave",
            days: activeContract.specialLeaveDays,
            type: "special",
            description: "Contractual special / educational allowance",
        }] : []),
        ...(tenureSpecialLeaveDays > 0 ? [{
            source: "Tariff Tenure Milestone Leave",
            days: tenureSpecialLeaveDays,
            type: "tenure",
            description: "Tariff collective agreement milestone entitlement",
        }] : []),
        ...(activeContract?.yearlyBonusLeaveConversion ? [{
            source: "Bonus-to-Leave Conversion Option",
            days: null,
            type: "bonus_conversion",
            description: "Eligible to convert yearly bonus percentage into free days",
        }] : []),
    ];

    // 3. Talent Absences: previous & planned
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allRequests = talentRecord.timeOffRequests || [];
    let currentRequest = null;
    if (currentRequestId) {
        currentRequest = allRequests.find((r: any) => r.id === currentRequestId) || null;
    }

    const previousAbsences = allRequests
        .filter((r: any) => r.id !== currentRequestId && new Date(r.endDate) < today)
        .map((r: any) => ({
            id: r.id,
            type: r.type,
            status: r.status,
            startDate: r.startDate instanceof Date ? r.startDate.toISOString() : String(r.startDate),
            endDate: r.endDate instanceof Date ? r.endDate.toISOString() : String(r.endDate),
            reason: r.reason,
            managerComment: r.managerComment,
            days: calculateAbsenceDays(r.startDate, r.endDate, { eveDaysFree: activeContract?.eveDaysFree ?? true }).workingDays
        }));

    const plannedAbsences = allRequests
        .filter((r: any) => r.id !== currentRequestId && new Date(r.endDate) >= today)
        .map((r: any) => ({
            id: r.id,
            type: r.type,
            status: r.status,
            startDate: r.startDate instanceof Date ? r.startDate.toISOString() : String(r.startDate),
            endDate: r.endDate instanceof Date ? r.endDate.toISOString() : String(r.endDate),
            reason: r.reason,
            managerComment: r.managerComment,
            days: calculateAbsenceDays(r.startDate, r.endDate, { eveDaysFree: activeContract?.eveDaysFree ?? true }).workingDays
        }));

    // 4. Public Holidays & Requested Dates Impact
    const publicHolidaysYear = getPublicHolidays(currentYear);
    let requestedImpact: (AbsenceCalculationResult & { projectedRemainingDays: number }) | null = null;

    const effStartDate = startDate || (currentRequest ? currentRequest.startDate : null);
    const effEndDate = endDate || (currentRequest ? currentRequest.endDate : null);

    if (effStartDate && effEndDate) {
        const calc = calculateAbsenceDays(effStartDate, effEndDate, {
            workDaysPerWeek: activeContract?.workDaysPerWeek ?? 5,
            eveDaysFree: activeContract?.eveDaysFree ?? true
        });
        const projectedRemainingDays = Math.max(0, remainingDays - calc.workingDays);
        requestedImpact = {
            ...calc,
            projectedRemainingDays
        };
    }

    return {
        talent: {
            id: talentRecord.id,
            displayName: talentRecord.contact?.displayName || `${talentRecord.contact?.givenName || ''} ${talentRecord.contact?.familyName || ''}`.trim() || 'Employee',
            jobTitle: talentRecord.jobTitle || 'Team Member',
            tags,
        },
        contract: activeContract ? {
            id: activeContract.id,
            wageTable: activeContract.wageTable,
            holidayAllotmentDays: activeContract.holidayAllotmentDays,
            specialLeaveDays: activeContract.specialLeaveDays,
            workDaysPerWeek: activeContract.workDaysPerWeek ?? 5,
            eveDaysFree: activeContract.eveDaysFree ?? true,
            yearlyBonusLeaveConversion: activeContract.yearlyBonusLeaveConversion ?? false,
        } : null,
        balances: {
            year: currentYear,
            totalDays: balance.totalDays,
            usedDays: balance.usedDays || 0,
            pendingDays: balance.pendingDays || 0,
            remainingDays,
        },
        allotmentSources,
        previousAbsences,
        plannedAbsences,
        currentRequest: currentRequest ? {
            id: currentRequest.id,
            type: currentRequest.type,
            status: currentRequest.status,
            startDate: currentRequest.startDate instanceof Date ? currentRequest.startDate.toISOString() : String(currentRequest.startDate),
            endDate: currentRequest.endDate instanceof Date ? currentRequest.endDate.toISOString() : String(currentRequest.endDate),
            reason: currentRequest.reason,
            managerComment: currentRequest.managerComment,
            managerId: currentRequest.managerId,
            createdAt: currentRequest.createdAt instanceof Date ? currentRequest.createdAt.toISOString() : String(currentRequest.createdAt),
        } : null,
        publicHolidays: publicHolidaysYear,
        requestedImpact,
    };
});

/**
 * Surrounding Team & Colleague Absences with Full Filter Flexibility
 */
export const getTeamSurroundingAbsences = query(teamSurroundingAbsencesInputSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'timesheets');

    const {
        startDate,
        endDate,
        excludeTalentId,
        tagId,
        talentId,
        locationId,
        status,
        type,
        search = ''
    } = input;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const windowStart = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);
    const windowEnd = new Date(end.getTime() + 7 * 24 * 60 * 60 * 1000);

    // 1. Determine team tags if tagId is not explicitly provided
    let teamTagIds: string[] = [];
    if (tagId) {
        const { include } = parseFilterValue(tagId);
        teamTagIds = include;
    } else if (excludeTalentId) {
        const talentTags = await db.select({ tagId: talentTag.tagId })
            .from(talentTag)
            .where(eq(talentTag.talentId, excludeTalentId));
        teamTagIds = talentTags.map(t => t.tagId);

        if (teamTagIds.length === 0) {
            const talentRow = await db.select({ contactId: talent.contactId }).from(talent).where(eq(talent.id, excludeTalentId)).limit(1);
            if (talentRow[0]?.contactId) {
                const cTags = await db.select({ tagId: contactTag.tagId }).from(contactTag).where(eq(contactTag.contactId, talentRow[0].contactId));
                teamTagIds = cTags.map(t => t.tagId);
            }
        }
    }

    // 2. Query team members / colleagues
    const { contact } = await import('@ac/db');
    let memberQuery = db.select({
        id: talent.id,
        contactId: talent.contactId,
        jobTitle: talent.jobTitle,
        contactName: contact.displayName,
    })
    .from(talent)
    .innerJoin(contact, eq(talent.contactId, contact.id))
    .$dynamic();

    const memberConditions: any[] = [];
    if (excludeTalentId) {
        memberConditions.push(sql`${talent.id} != ${excludeTalentId}`);
    }

    if (talentId) {
        const { include, exclude } = parseFilterValue(talentId);
        if (include.length > 0) memberConditions.push(inArray(talent.id, include));
        if (exclude.length > 0) memberConditions.push(notInArray(talent.id, exclude));
    }

    if (tagId) {
        const { include, exclude } = parseFilterValue(tagId);
        if (include.length > 0) {
            memberConditions.push(or(
                exists(db.select({ id: sql`1` }).from(talentTag).where(and(eq(talentTag.talentId, talent.id), inArray(talentTag.tagId, include)))),
                exists(db.select({ id: sql`1` }).from(contactTag).where(and(eq(contactTag.contactId, talent.contactId), inArray(contactTag.tagId, include))))
            ));
        }
        if (exclude.length > 0) {
            memberConditions.push(and(
                not(exists(db.select({ id: sql`1` }).from(talentTag).where(and(eq(talentTag.talentId, talent.id), inArray(talentTag.tagId, exclude))))),
                not(exists(db.select({ id: sql`1` }).from(contactTag).where(and(eq(contactTag.contactId, talent.contactId), inArray(contactTag.tagId, exclude)))))
            ));
        }
    } else if (teamTagIds.length > 0) {
        memberConditions.push(or(
            exists(db.select({ id: sql`1` }).from(talentTag).where(and(eq(talentTag.talentId, talent.id), inArray(talentTag.tagId, teamTagIds)))),
            exists(db.select({ id: sql`1` }).from(contactTag).where(and(eq(contactTag.contactId, talent.contactId), inArray(contactTag.tagId, teamTagIds))))
        ));
    }

    if (locationId) {
        const { include, exclude } = parseFilterValue(locationId);
        if (include.length > 0) {
            memberConditions.push(exists(
                db.select({ id: sql`1` }).from(locationContact).where(and(eq(locationContact.contactId, talent.contactId), inArray(locationContact.locationId, include)))
            ));
        }
        if (exclude.length > 0) {
            memberConditions.push(not(exists(
                db.select({ id: sql`1` }).from(locationContact).where(and(eq(locationContact.contactId, talent.contactId), inArray(locationContact.locationId, exclude)))
            )));
        }
    }

    if (search.trim()) {
        memberConditions.push(or(
            ilike(contact.displayName, `%${search}%`),
            ilike(talent.jobTitle, `%${search}%`)
        ));
    }

    if (memberConditions.length > 0) {
        memberQuery = memberQuery.where(and(...memberConditions));
    }

    const teamMembersList = await memberQuery.limit(50);
    const memberIds = teamMembersList.map(m => m.id);

    if (memberIds.length === 0) {
        return {
            teamMembers: [],
            overlappingAbsences: [],
            coverageSummary: {
                totalTeamMembers: 0,
                absentTeamMembers: 0,
                overlappingAbsencesCount: 0,
                coveragePercent: 100,
                riskLevel: 'none',
            },
            teamTagIds,
        };
    }

    // Fetch tags for these members
    const memberTags = await db.select({
        talentId: talentTag.talentId,
        tagId: tag.id,
        tagName: tag.name,
        tagColor: tag.color,
    })
    .from(talentTag)
    .innerJoin(tag, eq(talentTag.tagId, tag.id))
    .where(inArray(talentTag.talentId, memberIds));

    const tagsByTalentId = new Map<string, Array<{ id: string; name: string; color: string }>>();
    for (const mt of memberTags) {
        const arr = tagsByTalentId.get(mt.talentId) || [];
        arr.push({ id: mt.tagId, name: mt.tagName, color: mt.tagColor });
        tagsByTalentId.set(mt.talentId, arr);
    }

    // 3. Query absences for these team members overlapping or adjacent
    let absenceQuery = db.select({
        id: timeOffRequest.id,
        talentId: timeOffRequest.talentId,
        type: timeOffRequest.type,
        status: timeOffRequest.status,
        startDate: timeOffRequest.startDate,
        endDate: timeOffRequest.endDate,
        reason: timeOffRequest.reason,
    })
    .from(timeOffRequest)
    .where(and(
        inArray(timeOffRequest.talentId, memberIds),
        sql`${timeOffRequest.startDate} <= ${windowEnd}`,
        sql`${timeOffRequest.endDate} >= ${windowStart}`,
    ))
    .$dynamic();

    const absenceConditions: any[] = [];
    if (status) {
        const { include, exclude } = parseFilterValue(status);
        if (include.length > 0) absenceConditions.push(inArray(timeOffRequest.status, include as any));
        if (exclude.length > 0) absenceConditions.push(notInArray(timeOffRequest.status, exclude as any));
    } else {
        absenceConditions.push(inArray(timeOffRequest.status, ['pending', 'approved'] as any));
    }

    if (type) {
        const { include, exclude } = parseFilterValue(type);
        if (include.length > 0) absenceConditions.push(inArray(timeOffRequest.type, include as any));
        if (exclude.length > 0) absenceConditions.push(notInArray(timeOffRequest.type, exclude as any));
    }

    if (absenceConditions.length > 0) {
        absenceQuery = absenceQuery.where(and(...absenceConditions));
    }

    const absences = await absenceQuery.orderBy(asc(timeOffRequest.startDate));

    // 4. Compute direct overlaps and coverage impact
    const targetStart = new Date(startDate);
    const targetEnd = new Date(endDate);

    const absentTalentIdSet = new Set<string>();
    let directOverlapCount = 0;

    const memberMap = new Map(teamMembersList.map(m => [m.id, m]));

    const overlappingAbsences = absences.map(a => {
        const aStart = new Date(a.startDate);
        const aEnd = new Date(a.endDate);

        const isDirectOverlap = aStart <= targetEnd && aEnd >= targetStart;
        let overlapDays = 0;

        if (isDirectOverlap) {
            directOverlapCount++;
            absentTalentIdSet.add(a.talentId);
            const oStart = aStart > targetStart ? aStart : targetStart;
            const oEnd = aEnd < targetEnd ? aEnd : targetEnd;
            overlapDays = Math.ceil((oEnd.getTime() - oStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        }

        const mem = memberMap.get(a.talentId);
        return {
            id: a.id,
            talentId: a.talentId,
            talentName: mem?.contactName || 'Colleague',
            jobTitle: mem?.jobTitle || '',
            tags: tagsByTalentId.get(a.talentId) || [],
            type: a.type,
            status: a.status,
            startDate: a.startDate instanceof Date ? a.startDate.toISOString() : String(a.startDate),
            endDate: a.endDate instanceof Date ? a.endDate.toISOString() : String(a.endDate),
            reason: a.reason,
            isDirectOverlap,
            overlapDays,
        };
    });

    const totalTeamMembers = teamMembersList.length;
    const absentTeamMembers = absentTalentIdSet.size;
    const availableMembers = Math.max(0, totalTeamMembers - absentTeamMembers);
    const coveragePercent = totalTeamMembers > 0 ? Math.round((availableMembers / totalTeamMembers) * 100) : 100;

    let riskLevel: 'none' | 'low' | 'medium' | 'high' = 'none';
    if (absentTeamMembers >= 2 || (totalTeamMembers > 1 && coveragePercent < 60)) {
        riskLevel = 'high';
    } else if (absentTeamMembers === 1) {
        riskLevel = 'medium';
    }

    return {
        teamMembers: teamMembersList.map(m => ({
            id: m.id,
            name: m.contactName,
            jobTitle: m.jobTitle,
            tags: tagsByTalentId.get(m.id) || [],
        })),
        overlappingAbsences,
        coverageSummary: {
            totalTeamMembers,
            absentTeamMembers,
            overlappingAbsencesCount: directOverlapCount,
            coveragePercent,
            riskLevel,
        },
        teamTagIds,
    };
});

/**
 * Review Absence Request: Approve or Reject with Audit & Balance Adjustment
 */
export const reviewTimeOffRequest = command(reviewTimeOffSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'timesheets');

    const req = await db.query.timeOffRequest.findFirst({
        where: eq(timeOffRequest.id, data.requestId),
    });

    if (!req) {
        throw new Error('Leave request not found');
    }

    const previousStatus = req.status;
    const newStatus = data.action === 'approve' ? 'approved' : 'rejected';

    await db.update(timeOffRequest).set({
        status: newStatus,
        managerId: user.id,
        managerComment: data.comment || null,
        updatedAt: new Date(),
    }).where(eq(timeOffRequest.id, req.id));

    // Update balances
    const currentYear = new Date(req.startDate).getFullYear();
    const workingDays = calculateAbsenceDays(req.startDate, req.endDate).workingDays;

    const balance = await db.query.timeOffBalance.findFirst({
        where: and(
            eq(timeOffBalance.talentId, req.talentId),
            eq(timeOffBalance.year, currentYear)
        )
    });

    if (balance) {
        let newPending = balance.pendingDays || 0;
        let newUsed = balance.usedDays || 0;

        if (previousStatus === 'pending') {
            newPending = Math.max(0, newPending - workingDays);
            if (newStatus === 'approved') {
                newUsed = newUsed + workingDays;
            }
        } else if (previousStatus === 'approved' && newStatus === 'rejected') {
            newUsed = Math.max(0, newUsed - workingDays);
        }

        await db.update(timeOffBalance).set({
            pendingDays: newPending,
            usedDays: newUsed,
            updatedAt: new Date(),
        }).where(eq(timeOffBalance.id, balance.id));
    }

    void listTimeOffRequests().refresh();
    void listTimeOffRequests({}).refresh();
    void getMyTimeOffRequests(req.talentId).refresh();
    void getMyTimeOffBalances(req.talentId).refresh();

    return { success: true, status: newStatus, requestId: req.id };
});
