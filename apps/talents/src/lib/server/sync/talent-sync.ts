import {
    db,
    syncConfig,
    syncMapping,
    syncOperation,
    talent,
    jobPosting,
    eq,
    and,
    inArray,
    desc,
    ensureRecruitmentSchema,
} from "@ac/db";

/**
 * Ensures default synchronization configurations exist for ac-talents so per-talent
 * and per-job-role synchronizations can be activated out-of-the-box (modeled on ac-multiposter).
 */
export async function ensureDefaultTalentSyncConfigs(userId: string) {
    await ensureRecruitmentSchema();

    const existing = await db.select().from(syncConfig).orderBy(desc(syncConfig.createdAt));
    if (existing.length > 0) {
        return existing;
    }

    const defaults = [
        {
            userId: userId || "system",
            name: "Microsoft 365 / Entra ID Kontakte & Verzeichnis",
            providerId: "m365-entra-contacts",
            providerType: "microsoft-contacts",
            direction: "bidirectional",
            enabled: true,
            status: "active",
            settings: {
                isDefault: true,
                mailboxEmail: "hr@ngo-organization.org",
                syncFields: ["displayName", "email", "phone", "department", "jobTitle"],
            },
        },
        {
            userId: userId || "system",
            name: "Microsoft Teams Shifts & Interview-Kalender",
            providerId: "m365-teams-shifts",
            providerType: "microsoft-calendar",
            direction: "bidirectional",
            enabled: true,
            status: "active",
            settings: {
                isDefault: true,
                calendarId: "recruiting-shifts@ngo-organization.org",
            },
        },
        {
            userId: userId || "system",
            name: "Bewerber- & Onboarding E-Mail-Benachrichtigungen",
            providerId: "talent-email-automation",
            providerType: "email",
            direction: "push",
            enabled: true,
            status: "active",
            settings: {
                isDefault: false,
                senderName: "HR & Talent Team",
            },
        },
    ];

    const inserted = await db.insert(syncConfig).values(defaults).returning();
    return inserted;
}

/**
 * Synchronizes a Talent's selected syncConfig IDs (`syncIds`) and records `syncMapping` + `syncOperation` rows.
 */
export async function syncTalentTargets(userId: string, talentId: string, syncConfigIds: string[]) {
    await ensureRecruitmentSchema();
    const cleanIds = Array.from(new Set((syncConfigIds || []).filter(Boolean)));

    await db
        .update(talent)
        .set({
            syncIds: cleanIds,
            updatedAt: new Date(),
        })
        .where(eq(talent.id, talentId));

    // Remove mappings no longer selected for this talent
    const existingMappings = await db
        .select()
        .from(syncMapping)
        .where(eq(syncMapping.talentId, talentId));

    for (const mapping of existingMappings) {
        if (!cleanIds.includes(mapping.syncConfigId)) {
            await db.delete(syncMapping).where(eq(syncMapping.id, mapping.id));
        }
    }

    const existingConfigIds = new Set(existingMappings.map((m) => m.syncConfigId));
    const now = new Date();

    for (const configId of cleanIds) {
        if (!existingConfigIds.has(configId)) {
            await db.insert(syncMapping).values({
                syncConfigId: configId,
                externalId: `talent_${talentId.slice(0, 8)}_${configId.slice(0, 6)}`,
                talentId,
                providerId: "ac-talents-sync",
                lastSyncedAt: now,
                metadata: { syncedBy: userId, entityType: "talent" },
            });
        } else {
            await db
                .update(syncMapping)
                .set({ lastSyncedAt: now })
                .where(and(eq(syncMapping.talentId, talentId), eq(syncMapping.syncConfigId, configId)));
        }

        await db.insert(syncOperation).values({
            syncConfigId: configId,
            operation: "push",
            entityType: "talent",
            entityId: talentId,
            status: "completed",
            startedAt: now,
            completedAt: now,
            results: { synced: true, talentId },
        });
    }
}

/**
 * Synchronizes a Job Posting's selected syncConfig IDs (`syncIds`).
 */
export async function syncJobPostingTargets(userId: string, jobPostingId: string, syncConfigIds: string[]) {
    await ensureRecruitmentSchema();
    const cleanIds = Array.from(new Set((syncConfigIds || []).filter(Boolean)));

    await db
        .update(jobPosting)
        .set({
            syncIds: cleanIds,
            updatedAt: new Date(),
        })
        .where(eq(jobPosting.id, jobPostingId));

    const existingMappings = await db
        .select()
        .from(syncMapping)
        .where(eq(syncMapping.jobPostingId, jobPostingId));

    for (const mapping of existingMappings) {
        if (!cleanIds.includes(mapping.syncConfigId)) {
            await db.delete(syncMapping).where(eq(syncMapping.id, mapping.id));
        }
    }

    const existingConfigIds = new Set(existingMappings.map((m) => m.syncConfigId));
    const now = new Date();

    for (const configId of cleanIds) {
        if (!existingConfigIds.has(configId)) {
            await db.insert(syncMapping).values({
                syncConfigId: configId,
                externalId: `job_${jobPostingId.slice(0, 8)}_${configId.slice(0, 6)}`,
                jobPostingId,
                providerId: "ac-talents-job-sync",
                lastSyncedAt: now,
                metadata: { syncedBy: userId, entityType: "job_posting" },
            });
        }
    }
}

