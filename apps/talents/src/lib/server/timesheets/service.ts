import { db, timesheetEntry, timesheetAuditTrail, shiftPlan, talent, userTalent, userContact, task, getSuperior, eq, and, isNull, desc } from "@ac/db";
import { getAuthenticatedUser, ensureAccess, getOptionalUser } from "$lib/server/authorization";

export interface ClockInData {
    talentId: string;
    locationId?: string;
    type: "qr" | "gps" | "manual";
    latitude?: number;
    longitude?: number;
    startTime?: Date;
}

export async function clockIn(data: ClockInData, userId: string) {
    return await db.transaction(async (tx) => {
        // Check if user is already clocked in
        const activeEntry = await tx.query.timesheetEntry.findFirst({
            where: and(
                eq(timesheetEntry.talentId as any, data.talentId),
                isNull(timesheetEntry.endTime as any)
            ),
        });

        if (activeEntry) {
            throw new Error("User is already clocked in");
        }

        const startTime = data.startTime || new Date();

        // Optional: Find matching shift plan
        const activeShift = await tx.query.shiftPlan.findFirst({
            where: and(
                eq(shiftPlan.talentId as any, data.talentId),
            ),
            orderBy: desc(shiftPlan.startTime)
        });

        const [newEntry] = await tx.insert(timesheetEntry).values({
            talentId: data.talentId,
            locationId: data.locationId,
            type: data.type,
            latitude: data.latitude,
            longitude: data.longitude,
            startTime: startTime,
            shiftPlanId: activeShift?.id,
            status: "pending",
        }).returning();

        await logAuditTrail(tx, {
            timesheetEntryId: newEntry.id,
            changedByUserId: userId,
            operation: "create",
            newData: newEntry,
        });

        return newEntry;
    });
}

export async function clockOut(entryId: string, userId: string, geo?: { latitude?: number, longitude?: number, endTime?: Date }) {
    return await db.transaction(async (tx) => {
        const entry = await tx.query.timesheetEntry.findFirst({
            where: eq(timesheetEntry.id as any, entryId),
        });

        if (!entry || entry.endTime) {
            throw new Error("Invalid entry or already clocked out");
        }

        const endTime = geo?.endTime || new Date();

        const [updatedEntry] = await tx.update(timesheetEntry)
            .set({
                endTime: endTime,
                latitude: geo?.latitude || entry.latitude,
                longitude: geo?.longitude || entry.longitude,
                updatedAt: new Date(),
            })
            .where(eq(timesheetEntry.id as any, entryId))
            .returning();

        await logAuditTrail(tx, {
            timesheetEntryId: entryId,
            changedByUserId: userId,
            operation: "update",
            previousData: entry,
            newData: updatedEntry,
        });

        // Trigger task creation for approval
        await ensureApprovalTask(tx, updatedEntry.id, updatedEntry.talentId);

        return updatedEntry;
    });
}

export async function approveEntry(entryId: string, managerId: string, comment?: string) {
    return await db.transaction(async (tx) => {
        const entry = await tx.query.timesheetEntry.findFirst({
            where: eq(timesheetEntry.id as any, entryId),
        });

        if (!entry) throw new Error("Entry not found");

        const [updatedEntry] = await tx.update(timesheetEntry)
            .set({
                status: "approved",
                managerId,
                managerComment: comment,
                updatedAt: new Date(),
            })
            .where(eq(timesheetEntry.id as any, entryId))
            .returning();

        await logAuditTrail(tx, {
            timesheetEntryId: entryId,
            changedByUserId: managerId,
            operation: "approve",
            previousData: entry,
            newData: updatedEntry,
        });

        // Complete the task
        await tx.update(task)
            .set({ status: "completed" })
            .where(and(
                eq(task.type as any, "timesheet_approval"),
                eq(task.data as any, { timesheetEntryId: entryId } as any)
            ));

        return updatedEntry;
    });
}

export async function rejectEntry(entryId: string, managerId: string, comment?: string) {
    return await db.transaction(async (tx) => {
        const entry = await tx.query.timesheetEntry.findFirst({
            where: eq(timesheetEntry.id as any, entryId),
        });

        if (!entry) throw new Error("Entry not found");

        const [updatedEntry] = await tx.update(timesheetEntry)
            .set({
                status: "rejected",
                managerId,
                managerComment: comment,
                updatedAt: new Date(),
            })
            .where(eq(timesheetEntry.id as any, entryId))
            .returning();

        await logAuditTrail(tx, {
            timesheetEntryId: entryId,
            changedByUserId: managerId,
            operation: "reject",
            previousData: entry,
            newData: updatedEntry,
        });

        // Complete the approval task
        await tx.update(task)
            .set({ status: "completed" })
            .where(and(
                eq(task.type as any, "timesheet_approval"),
                eq(task.data as any, { timesheetEntryId: entryId } as any)
            ));

        // Create a correction task for the talent
        await tx.insert(task).values({
            type: "correction",
            status: "pending",
            assigneeId: entry.talentId,
            title: "Timesheet Correction Required",
            description: `Your timesheet entry for ${entry.startTime.toLocaleDateString()} was rejected. Reason: ${comment || "No reason provided."}`,
            data: { timesheetEntryId: entryId },
        } as any);

        return updatedEntry;
    });
}

export async function updateEntryManual(entryId: string, managerId: string, data: Partial<typeof timesheetEntry.$inferInsert>) {
    return await db.transaction(async (tx) => {
        const entry = await tx.query.timesheetEntry.findFirst({
            where: eq(timesheetEntry.id as any, entryId),
        });

        if (!entry) throw new Error("Entry not found");

        const [updatedEntry] = await tx.update(timesheetEntry)
            .set({
                ...data,
                managerId, // Mark that it was edited by a manager
                updatedAt: new Date(),
            })
            .where(eq(timesheetEntry.id as any, entryId))
            .returning();

        await logAuditTrail(tx, {
            timesheetEntryId: entryId,
            changedByUserId: managerId,
            operation: "update",
            previousData: entry,
            newData: updatedEntry,
        });

        return updatedEntry;
    });
}

export async function getMyTalentIdCore() {
    const authUser = getOptionalUser();
    if (!authUser) {
        console.warn('[getMyTalentIdCore] No authenticated user found.');
        return null;
    }

    try {
        // Step 1: Check direct talent association
        const ut = await db.select({ id: userTalent.talentId }).from(userTalent).where(eq(userTalent.userId as any, authUser.id)).limit(1);
        if (ut[0]) {
            return ut[0].id;
        }

        // Step 2: Get contact ID for user as fallback
        const uc = await db.select().from(userContact).where(eq(userContact.userId as any, authUser.id)).limit(1);
        if (!uc[0]) return null;

        // Step 3: Get talent for that contact
        const t = await db.select({ id: talent.id }).from(talent).where(eq(talent.contactId as any, uc[0].contactId)).limit(1);
        return t[0]?.id || null;
    } catch (e: any) {
        console.error('getMyTalentIdCore failed:', e);
        return null;
    }
}

export async function getMyStatus(talentId: string) {
    const authUser = getAuthenticatedUser();
    
    // Allow if user has 'timesheets' claim OR if they are requesting their own talent ID
    const myTalentId = await getMyTalentIdCore();
    if (talentId !== myTalentId) {
        ensureAccess(authUser, 'timesheets');
    }
    
    const activeEntry = await db.select().from(timesheetEntry)
        .where(and(
            eq(timesheetEntry.talentId, talentId),
            isNull(timesheetEntry.endTime)
        ) as any)
        .limit(1);

    const recentEntries = await db.select().from(timesheetEntry)
        .where(eq(timesheetEntry.talentId, talentId) as any)
        .orderBy(desc(timesheetEntry.startTime) as any)
        .limit(10);

    const shiftPlans = await db.select().from(shiftPlan)
        .where(eq(shiftPlan.talentId, talentId) as any)
        .orderBy(desc(shiftPlan.startTime) as any)
        .limit(5);

    return {
        activeEntry: activeEntry[0] || null,
        recentEntries: recentEntries || [],
        shiftPlans: shiftPlans || []
    };
}

async function logAuditTrail(tx: any, data: {
    timesheetEntryId: string;
    changedByUserId: string;
    operation: "create" | "update" | "delete" | "approve" | "reject";
    previousData?: any;
    newData?: any;
}) {
    await tx.insert(timesheetAuditTrail).values({
        timesheetEntryId: data.timesheetEntryId,
        changedByUserId: data.changedByUserId,
        operation: data.operation,
        previousData: data.previousData,
        newData: data.newData,
        timestamp: new Date(),
    } as any);
}

async function ensureApprovalTask(tx: any, entryId: string, talentId: string) {
    // 1. Find the manager
    const manager = await getSuperior(talentId);
    
    // If no manager, the top-level superior approves their own time (or no task created if they are the one approving)
    // The requirement says "top level superiors approve their own times".
    // So we assign the task to themselves if no manager is found.
    const assigneeId = manager?.id || talentId;

    // 2. Check for existing pending approval task for this entry
    const existingTask = await tx.query.task.findFirst({
        where: and(
            eq(task.type, "timesheet_approval"),
            eq(task.status, "pending"),
            eq(task.data, { timesheetEntryId: entryId } as any)
        ) as any
    });

    if (existingTask) {
        // Update updated_at to bring it to top
        await tx.update(task)
            .set({ updatedAt: new Date() })
            .where(eq(task.id, existingTask.id) as any);
    } else {
        // Create new task
        await tx.insert(task).values({
            type: "timesheet_approval",
            status: "pending",
            assigneeId: assigneeId,
            creatorId: talentId,
            title: "Timesheet Approval Requested",
            description: `A new timesheet entry requires your review.`,
            data: { timesheetEntryId: entryId },
        } as any);
    }
}
