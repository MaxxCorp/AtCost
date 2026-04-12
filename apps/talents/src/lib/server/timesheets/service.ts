import { db } from "../db";
import { timesheetEntry, timesheetAuditTrail, shiftPlan, talent, userTalent, userContact } from "../db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { getAuthenticatedUser, ensureAccess, getOptionalUser } from "$lib/server/authorization";

export interface ClockInData {
    talentId: string;
    locationId?: string;
    type: "qr" | "gps" | "manual";
    latitude?: number;
    longitude?: number;
}

export async function clockIn(data: ClockInData, userId: string) {
    return await db.transaction(async (tx) => {
        // Check if user is already clocked in
        const activeEntry = await tx.query.timesheetEntry.findFirst({
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
        const activeShift = await tx.query.shiftPlan.findFirst({
            where: and(
                eq(shiftPlan.talentId, data.talentId),
                // Roughly matching today
            ),
            orderBy: desc(shiftPlan.startTime)
        });

        const [newEntry] = await tx.insert(timesheetEntry).values({
            talentId: data.talentId,
            locationId: data.locationId,
            type: data.type,
            latitude: data.latitude,
            longitude: data.longitude,
            startTime: now,
            shiftPlanId: activeShift?.id,
            status: "pending",
        } as any).returning();

        await logAuditTrail(tx, {
            timesheetEntryId: newEntry.id,
            changedByUserId: userId,
            operation: "create",
            newData: newEntry,
        });

        return newEntry;
    });
}

export async function clockOut(entryId: string, userId: string, geo?: { latitude?: number, longitude?: number }) {
    return await db.transaction(async (tx) => {
        const entry = await tx.query.timesheetEntry.findFirst({
            where: eq(timesheetEntry.id, entryId),
        });

        if (!entry || entry.endTime) {
            throw new Error("Invalid entry or already clocked out");
        }

        const [updatedEntry] = await tx.update(timesheetEntry)
            .set({
                endTime: new Date(),
                latitude: geo?.latitude || entry.latitude,
                longitude: geo?.longitude || entry.longitude,
                updatedAt: new Date(),
            })
            .where(eq(timesheetEntry.id, entryId))
            .returning();

        await logAuditTrail(tx, {
            timesheetEntryId: entryId,
            changedByUserId: userId,
            operation: "update",
            previousData: entry,
            newData: updatedEntry,
        });

        return updatedEntry;
    });
}

export async function approveEntry(entryId: string, managerId: string, comment?: string) {
    return await db.transaction(async (tx) => {
        const entry = await tx.query.timesheetEntry.findFirst({
            where: eq(timesheetEntry.id, entryId),
        });

        if (!entry) throw new Error("Entry not found");

        const [updatedEntry] = await tx.update(timesheetEntry)
            .set({
                status: "approved",
                managerId,
                managerComment: comment,
                updatedAt: new Date(),
            })
            .where(eq(timesheetEntry.id, entryId))
            .returning();

        await logAuditTrail(tx, {
            timesheetEntryId: entryId,
            changedByUserId: managerId,
            operation: "approve",
            previousData: entry,
            newData: updatedEntry,
        });

        return updatedEntry;
    });
}

export async function rejectEntry(entryId: string, managerId: string, comment?: string) {
    return await db.transaction(async (tx) => {
        const entry = await tx.query.timesheetEntry.findFirst({
            where: eq(timesheetEntry.id, entryId),
        });

        if (!entry) throw new Error("Entry not found");

        const [updatedEntry] = await tx.update(timesheetEntry)
            .set({
                status: "rejected",
                managerId,
                managerComment: comment,
                updatedAt: new Date(),
            })
            .where(eq(timesheetEntry.id, entryId))
            .returning();

        await logAuditTrail(tx, {
            timesheetEntryId: entryId,
            changedByUserId: managerId,
            operation: "reject",
            previousData: entry,
            newData: updatedEntry,
        });

        return updatedEntry;
    });
}

export async function updateEntryManual(entryId: string, managerId: string, data: Partial<typeof timesheetEntry.$inferInsert>) {
    return await db.transaction(async (tx) => {
        const entry = await tx.query.timesheetEntry.findFirst({
            where: eq(timesheetEntry.id, entryId),
        });

        if (!entry) throw new Error("Entry not found");

        const [updatedEntry] = await tx.update(timesheetEntry)
            .set({
                ...data,
                managerId, // Mark that it was edited by a manager
                updatedAt: new Date(),
            })
            .where(eq(timesheetEntry.id, entryId))
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
        const ut = await db.select({ id: userTalent.talentId }).from(userTalent).where(eq(userTalent.userId, authUser.id)).limit(1);
        if (ut[0]) {
            return ut[0].id;
        }

        // Step 2: Get contact ID for user as fallback
        const uc = await db.select().from(userContact).where(eq(userContact.userId, authUser.id)).limit(1);
        if (!uc[0]) return null;

        // Step 3: Get talent for that contact
        const t = await db.select({ id: talent.id }).from(talent).where(eq(talent.contactId, uc[0].contactId)).limit(1);
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
