import { query, command, requested } from '$app/server';
import { db, shiftPlan, shiftSchedulingGroup, talent, contact, location, eq, and, gte, lte, asc, desc } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import * as v from 'valibot';
import {
    listShiftsSchema,
    createShiftSchema,
    updateShiftSchema,
    deleteShiftSchema,
    shareScheduleSchema,
    copyScheduleSchema,
    createSchedulingGroupSchema,
    updateSchedulingGroupSchema,
    deleteSchedulingGroupSchema,
    type ShiftDetail,
    type SchedulingGroupDetail
} from '@ac/validations';

export const listShifts = query(listShiftsSchema, async (input): Promise<ShiftDetail[]> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'shiftplans');

    const start = new Date(input.startDate);
    const end = new Date(input.endDate);

    const conditions: any[] = [
        gte(shiftPlan.startTime, start),
        lte(shiftPlan.startTime, end)
    ];

    if (input.locationId) {
        conditions.push(eq(shiftPlan.locationId, input.locationId));
    }
    if (input.schedulingGroupId) {
        conditions.push(eq(shiftPlan.schedulingGroupId, input.schedulingGroupId));
    }
    if (input.talentId) {
        conditions.push(eq(shiftPlan.talentId, input.talentId));
    }

    const rows = await db
        .select({
            id: shiftPlan.id,
            displayName: shiftPlan.displayName,
            talentId: shiftPlan.talentId,
            talentName: contact.displayName,
            schedulingGroupId: shiftPlan.schedulingGroupId,
            schedulingGroupName: shiftSchedulingGroup.name,
            locationId: shiftPlan.locationId,
            locationName: location.name,
            startTime: shiftPlan.startTime,
            endTime: shiftPlan.endTime,
            theme: shiftPlan.theme,
            isShared: shiftPlan.isShared,
            openSlotCount: shiftPlan.openSlotCount,
            activities: shiftPlan.activities,
            notes: shiftPlan.notes,
            externalId: shiftPlan.externalId,
            syncStatus: shiftPlan.syncStatus,
            createdAt: shiftPlan.createdAt,
            updatedAt: shiftPlan.updatedAt,
        })
        .from(shiftPlan)
        .leftJoin(talent, eq(shiftPlan.talentId, talent.id) as any)
        .leftJoin(contact, eq(talent.contactId, contact.id) as any)
        .leftJoin(shiftSchedulingGroup, eq(shiftPlan.schedulingGroupId, shiftSchedulingGroup.id) as any)
        .leftJoin(location, eq(shiftPlan.locationId, location.id) as any)
        .where(and(...conditions))
        .orderBy(asc(shiftPlan.startTime));

    return rows.map((r) => ({
        id: r.id,
        displayName: r.displayName,
        talentId: r.talentId,
        talentName: r.talentName,
        talentAvatar: null,
        schedulingGroupId: r.schedulingGroupId,
        schedulingGroupName: r.schedulingGroupName,
        locationId: r.locationId,
        locationName: r.locationName,
        startTime: r.startTime.toISOString(),
        endTime: r.endTime.toISOString(),
        theme: r.theme,
        isShared: r.isShared,
        openSlotCount: r.openSlotCount,
        activities: (r.activities as any) ?? [],
        notes: r.notes,
        externalId: r.externalId,
        syncStatus: r.syncStatus,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
    }));
});

export const createShift = command(createShiftSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'shiftplans');

    const [inserted] = await db.insert(shiftPlan).values({
        displayName: data.displayName || null,
        talentId: data.talentId || null,
        schedulingGroupId: data.schedulingGroupId || null,
        locationId: data.locationId || null,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        theme: data.theme || 'blue',
        notes: data.notes || null,
        isShared: data.isShared ?? false,
        openSlotCount: data.openSlotCount ?? 1,
        activities: data.activities && data.activities.length > 0 ? data.activities : null,
    }).returning({ id: shiftPlan.id });

    try {
        await requested(listShifts, 20).refreshAll();
    } catch { /* ignore */ }

    return inserted;
});

export const updateShift = command(updateShiftSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'shiftplans');

    const updateValues: Record<string, any> = {};
    if (data.displayName !== undefined) updateValues.displayName = data.displayName || null;
    if (data.talentId !== undefined) updateValues.talentId = data.talentId || null;
    if (data.schedulingGroupId !== undefined) updateValues.schedulingGroupId = data.schedulingGroupId || null;
    if (data.locationId !== undefined) updateValues.locationId = data.locationId || null;
    if (data.startTime) updateValues.startTime = new Date(data.startTime);
    if (data.endTime) updateValues.endTime = new Date(data.endTime);
    if (data.theme) updateValues.theme = data.theme;
    if (data.notes !== undefined) updateValues.notes = data.notes || null;
    if (data.isShared !== undefined) updateValues.isShared = data.isShared;
    if (data.openSlotCount !== undefined) updateValues.openSlotCount = data.openSlotCount;
    if (data.activities !== undefined) updateValues.activities = data.activities;

    await db.update(shiftPlan).set(updateValues).where(eq(shiftPlan.id, data.id));

    try {
        await requested(listShifts, 20).refreshAll();
    } catch { /* ignore */ }

    return { success: true };
});

export const deleteShift = command(deleteShiftSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'shiftplans');

    await db.delete(shiftPlan).where(eq(shiftPlan.id, data.id));

    try {
        await requested(listShifts, 20).refreshAll();
    } catch { /* ignore */ }

    return { success: true };
});

export const shareSchedule = command(shareScheduleSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'shiftplans');

    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    const conditions: any[] = [
        gte(shiftPlan.startTime, start),
        lte(shiftPlan.startTime, end),
        eq(shiftPlan.isShared, false),
    ];

    if (data.locationId) {
        conditions.push(eq(shiftPlan.locationId, data.locationId));
    }

    const updated = await db
        .update(shiftPlan)
        .set({ isShared: true })
        .where(and(...conditions))
        .returning({ id: shiftPlan.id });

    try {
        await requested(listShifts, 20).refreshAll();
    } catch { /* ignore */ }

    return { sharedCount: updated.length };
});

export const copySchedule = command(copyScheduleSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'shiftplans');

    const sourceStart = new Date(data.sourceStartDate);
    const sourceEnd = new Date(data.sourceEndDate);
    const targetStart = new Date(data.targetStartDate);

    const conditions: any[] = [
        gte(shiftPlan.startTime, sourceStart),
        lte(shiftPlan.startTime, sourceEnd)
    ];

    if (data.locationId) {
        conditions.push(eq(shiftPlan.locationId, data.locationId));
    }

    const sourceShifts = await db.select().from(shiftPlan).where(and(...conditions));

    if (sourceShifts.length === 0) {
        return { copiedCount: 0 };
    }

    const timeDifferenceMs = targetStart.getTime() - sourceStart.getTime();

    const newShifts = sourceShifts.map((s) => {
        const newStart = new Date(s.startTime.getTime() + timeDifferenceMs);
        const newEnd = new Date(s.endTime.getTime() + timeDifferenceMs);

        return {
            displayName: s.displayName,
            talentId: data.includeAssignedTalents ? s.talentId : null,
            locationId: s.locationId,
            schedulingGroupId: s.schedulingGroupId,
            startTime: newStart,
            endTime: newEnd,
            theme: s.theme,
            isShared: false, // Copied shifts start as drafts, matching MS Teams behavior!
            openSlotCount: s.openSlotCount,
            activities: s.activities,
            notes: s.notes,
        };
    });

    await db.insert(shiftPlan).values(newShifts);

    try {
        await requested(listShifts, 20).refreshAll();
    } catch { /* ignore */ }

    return { copiedCount: newShifts.length };
});

export const listSchedulingGroups = query(v.optional(v.object({ locationId: v.optional(v.string()) }), {}), async (input): Promise<SchedulingGroupDetail[]> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'shiftplans');

    const conditions: any[] = [];
    if (input?.locationId) {
        conditions.push(eq(shiftSchedulingGroup.locationId, input.locationId));
    }

    let q = db.select().from(shiftSchedulingGroup);
    if (conditions.length > 0) {
        q = q.where(and(...conditions)) as any;
    }

    const groups = await q.orderBy(asc(shiftSchedulingGroup.order), asc(shiftSchedulingGroup.name));

    if (groups.length === 0) {
        const defaults = [
            { name: "Front of House / Service", code: "FOH", color: "purple", order: 1 },
            { name: "Kitchen / Production", code: "KIT", color: "darkBlue", order: 2 },
            { name: "Logistics & Facilities", code: "LOG", color: "green", order: 3 },
            { name: "Management / Supervisors", code: "MGT", color: "blue", order: 4 },
        ];
        const inserted = await db.insert(shiftSchedulingGroup).values(defaults).returning();
        return inserted.map(g => ({
            id: g.id,
            name: g.name,
            code: g.code,
            color: g.color,
            locationId: g.locationId,
            order: g.order
        }));
    }

    return groups.map((g) => ({
        id: g.id,
        name: g.name,
        code: g.code,
        color: g.color,
        locationId: g.locationId,
        order: g.order,
    }));
});

export const createSchedulingGroup = command(createSchedulingGroupSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'shiftplans');

    const [inserted] = await db.insert(shiftSchedulingGroup).values({
        name: data.name,
        code: data.code || null,
        color: data.color || 'purple',
        locationId: data.locationId || null,
    }).returning();

    try {
        await requested(listSchedulingGroups, 20).refreshAll();
    } catch { /* ignore */ }

    return inserted;
});

export const updateSchedulingGroup = command(updateSchedulingGroupSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'shiftplans');

    const [updated] = await db.update(shiftSchedulingGroup).set({
        name: data.name,
        code: data.code || null,
        color: data.color || 'purple',
        locationId: data.locationId || null,
    }).where(eq(shiftSchedulingGroup.id, data.id)).returning();

    try {
        await requested(listSchedulingGroups, 20).refreshAll();
    } catch { /* ignore */ }

    return updated;
});

export const deleteSchedulingGroup = command(deleteSchedulingGroupSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'shiftplans');

    await db.delete(shiftSchedulingGroup).where(eq(shiftSchedulingGroup.id, data.id));

    try {
        await requested(listSchedulingGroups, 20).refreshAll();
    } catch { /* ignore */ }

    return { success: true };
});
