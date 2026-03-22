import { db } from "../db";
import { timesheetEntry, timesheetAuditTrail, shiftPlan } from "../db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";

export interface ClockInData {
    talentId: string;
    locationId?: string;
    type: "qr" | "gps" | "manual";
    latitude?: number;
    longitude?: number;
}

export async function clockIn(data: ClockInData) {
    // Check if user is already clocked in
    const activeEntry = await db.query.timesheetEntry.findFirst({
        where: and(
            eq(timesheetEntry.talentId, data.talentId),
            isNull(timesheetEntry.endTime)
        ),
    });

    if (activeEntry) {
        throw new Error("User is already clocked in");
    }

    // Optional: Find matching shift plan
    const now = new Date();
    const activeShift = await db.query.shiftPlan.findFirst({
        where: and(
            eq(shiftPlan.talentId, data.talentId),
            // Roughly matching today
            // In a real app we'd check if now is within shift bounds
        ),
        orderBy: desc(shiftPlan.startTime)
    });

    const [newEntry] = await db.insert(timesheetEntry).values({
        talentId: data.talentId,
        locationId: data.locationId,
        type: data.type,
        latitude: data.latitude,
        longitude: data.longitude,
        startTime: now,
        shiftPlanId: activeShift?.id,
        status: "pending",
    } as any).returning();

    await logAuditTrail({
        timesheetEntryId: newEntry.id,
        changedByUserId: data.talentId, // In self-service, talent clocks themselves in
        operation: "create",
        newData: newEntry,
    });

    return newEntry;
}

export async function clockOut(entryId: string, talentId: string, geo?: { latitude?: number, longitude?: number }) {
    const entry = await db.query.timesheetEntry.findFirst({
        where: eq(timesheetEntry.id, entryId),
    });

    if (!entry || entry.endTime) {
        throw new Error("Invalid entry or already clocked out");
    }

    const [updatedEntry] = await db.update(timesheetEntry)
        .set({
            endTime: new Date(),
            latitude: geo?.latitude || entry.latitude,
            longitude: geo?.longitude || entry.longitude,
            updatedAt: new Date(),
        })
        .where(eq(timesheetEntry.id, entryId))
        .returning();

    await logAuditTrail({
        timesheetEntryId: entryId,
        changedByUserId: talentId,
        operation: "update",
        previousData: entry,
        newData: updatedEntry,
    });

    return updatedEntry;
}

export async function approveEntry(entryId: string, managerId: string, comment?: string) {
    const entry = await db.query.timesheetEntry.findFirst({
        where: eq(timesheetEntry.id, entryId),
    });

    if (!entry) throw new Error("Entry not found");

    const [updatedEntry] = await db.update(timesheetEntry)
        .set({
            status: "approved",
            managerId,
            managerComment: comment,
            updatedAt: new Date(),
        })
        .where(eq(timesheetEntry.id, entryId))
        .returning();

    await logAuditTrail({
        timesheetEntryId: entryId,
        changedByUserId: managerId,
        operation: "approve",
        previousData: entry,
        newData: updatedEntry,
    });

    return updatedEntry;
}

export async function rejectEntry(entryId: string, managerId: string, comment?: string) {
    const entry = await db.query.timesheetEntry.findFirst({
        where: eq(timesheetEntry.id, entryId),
    });

    if (!entry) throw new Error("Entry not found");

    const [updatedEntry] = await db.update(timesheetEntry)
        .set({
            status: "rejected",
            managerId,
            managerComment: comment,
            updatedAt: new Date(),
        })
        .where(eq(timesheetEntry.id, entryId))
        .returning();

    await logAuditTrail({
        timesheetEntryId: entryId,
        changedByUserId: managerId,
        operation: "reject",
        previousData: entry,
        newData: updatedEntry,
    });

    return updatedEntry;
}

export async function updateEntryManual(entryId: string, managerId: string, data: Partial<typeof timesheetEntry.$inferInsert>) {
    const entry = await db.query.timesheetEntry.findFirst({
        where: eq(timesheetEntry.id, entryId),
    });

    if (!entry) throw new Error("Entry not found");

    const [updatedEntry] = await db.update(timesheetEntry)
        .set({
            ...data,
            managerId, // Mark that it was edited by a manager
            updatedAt: new Date(),
        })
        .where(eq(timesheetEntry.id, entryId))
        .returning();

    await logAuditTrail({
        timesheetEntryId: entryId,
        changedByUserId: managerId,
        operation: "update",
        previousData: entry,
        newData: updatedEntry,
    });

    return updatedEntry;
}

async function logAuditTrail(data: {
    timesheetEntryId: string;
    changedByUserId: string;
    operation: "create" | "update" | "delete" | "approve" | "reject";
    previousData?: any;
    newData?: any;
}) {
    await db.insert(timesheetAuditTrail).values({
        timesheetEntryId: data.timesheetEntryId,
        changedByUserId: data.changedByUserId,
        operation: data.operation,
        previousData: data.previousData,
        newData: data.newData,
        timestamp: new Date(),
    } as any);
}
