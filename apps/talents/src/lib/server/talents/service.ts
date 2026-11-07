import { db, talent, talentTimelineEntry, contact, user, contactEmail, contactPhone, contactTag, contactRelation, tag, contactAddress, locationContact, userContact, userTalent, eq, desc, inArray, and, sql, decryptContactRecord } from '@ac/db';
// Unifying Drizzle operators via @ac/db

export interface TalentProfile {
    id: string;
    contactId: string;
    status: string;
    pipelineStage?: string;
    jobPostingId?: string | null;
    department?: string | null;
    jobTitle: string | null;
    salaryExpectation: string | null;
    availabilityDate: string | null;
    onboardingStatus: string | null;
    resumeUrl: string | null;
    source: string | null;
    internalNotes: string | null;
    averageRating?: number | null;
    syncIds?: string[];
    currentVersion?: number;
    latestLedgerBlockHash?: string | null;
    customFieldValues?: Record<string, unknown>;
    lastModifiedByUserId?: string | null;
    lastModifiedChannel?: string | null;
    createdAt: string;
    updatedAt: string;
    linkedUser: { id: string; name: string; email: string } | null;
    contact: any;
    timelineEntries: any[];
}

export async function readTalent(id: string): Promise<TalentProfile | null> {
    const result = await db.query.talent.findFirst({
        where: eq(talent.id, id),
        with: {
            contact: {
                with: {
                    emails: true,
                    phones: true,
                    addresses: true,
                    locationAssociations: { with: { location: true } },
                    tags: { with: { tag: true } },
                    relations: { with: { targetContact: true } }
                }
            },
            timelineEntries: {
                orderBy: [desc(talentTimelineEntry.timestamp)]
            }
        }
    });

    if (!result) {
        console.warn(`[readTalentCore] No talent found with ID: ${id}`);
        return null;
    }

    try {

    const contactData = result.contact ? await decryptContactRecord(result.contact) : null;

    // Resolve linked user
    let linkedUser: { id: string; name: string; email: string } | null = null;
    
    // Check userContact (implicit)
    if (result.contact) {
        const uc = await db.select({ userId: userContact.userId })
            .from(userContact)
            .where(eq(userContact.contactId, result.contact.id))
            .limit(1);
        
        let userId = uc[0]?.userId;
        
        // Check userTalent (explicit) if no contact link found
        if (!userId) {
            const ut = await db.select({ userId: userTalent.userId })
                .from(userTalent)
                .where(eq(userTalent.talentId, result.id))
                .limit(1);
            userId = ut[0]?.userId;
        }

        if (userId) {
            const [u] = await db.select({ id: user.id, name: user.name, email: user.email })
                .from(user)
                .where(eq(user.id, userId))
                .limit(1);
            if (u) linkedUser = u;
        }
    }

    // NEW: Step 3: Global email fallback if no link found yet
    if (!linkedUser && contactData) {
        const emails = (contactData.emails || []).map((e: any) => e.value.toLowerCase());
        if (emails.length > 0) {
            const [u] = await db.select({ id: user.id, name: user.name, email: user.email })
                .from(user)
                .where(inArray(sql`LOWER(${user.email})`, emails))
                .limit(1);
            if (u) linkedUser = u;
        }
    }

    return {
        id: result.id,
        contactId: result.contactId,
        status: result.status,
        pipelineStage: result.pipelineStage ?? 'applied',
        jobPostingId: result.jobPostingId ?? null,
        department: result.department ?? contactData?.department ?? null,
        jobTitle: result.jobTitle,
        salaryExpectation: result.salaryExpectation,
        availabilityDate: result.availabilityDate instanceof Date ? result.availabilityDate.toISOString() : (result.availabilityDate ?? null),
        onboardingStatus: result.onboardingStatus,
        resumeUrl: result.resumeUrl,
        source: result.source,
        internalNotes: result.internalNotes,
        averageRating: result.averageRating ?? null,
        syncIds: result.syncIds ?? [],
        currentVersion: result.currentVersion ?? 1,
        latestLedgerBlockHash: result.latestLedgerBlockHash ?? null,
        customFieldValues: result.customFieldValues ?? {},
        lastModifiedByUserId: result.lastModifiedByUserId ?? null,
        lastModifiedChannel: result.lastModifiedChannel ?? 'internal_ui',
        createdAt: result.createdAt?.toISOString?.() ?? (result.createdAt instanceof Date ? result.createdAt.toISOString() : result.createdAt),
        updatedAt: result.updatedAt?.toISOString?.() ?? (result.updatedAt instanceof Date ? result.updatedAt.toISOString() : result.updatedAt),
        linkedUser,
        contact: contactData ? {
            id: contactData.id,
            displayName: contactData.displayName,
            givenName: contactData.givenName,
            familyName: contactData.familyName,
            company: contactData.company,
            role: contactData.role,
            department: contactData.department,
            birthday: contactData.birthday instanceof Date ? contactData.birthday.toISOString() : (contactData.birthday ?? null),
            notes: contactData.notes,
            isPublic: contactData.isPublic,
            createdAt: contactData.createdAt?.toISOString?.() ?? (contactData.createdAt instanceof Date ? contactData.createdAt.toISOString() : String(contactData.createdAt)),
            updatedAt: contactData.updatedAt?.toISOString?.() ?? (contactData.updatedAt instanceof Date ? contactData.updatedAt.toISOString() : String(contactData.updatedAt)),
            emails: contactData.emails || [],
            phones: contactData.phones || [],
            addresses: contactData.addresses || [],
            locationAssociations: contactData.locationAssociations || [],
            relations: (contactData.relations || []).map((r: any) => ({
                id: r.id,
                targetContactId: r.targetContactId,
                relationType: r.relationType,
                targetContact: r.targetContact ? {
                    id: r.targetContact.id,
                    displayName: r.targetContact.displayName,
                    givenName: r.targetContact.givenName,
                    familyName: r.targetContact.familyName,
                } : null,
            })),
            tags: (contactData.tags || []).map((ct: any) => ({
                id: ct.tag?.id,
                name: ct.tag?.name
            })).filter((t: any) => t.name)
        } : null,
        timelineEntries: (result.timelineEntries || []).map((te: any) => ({
            id: te.id,
            type: te.type,
            title: te.title,
            description: te.description,
            date: te.date?.toISOString?.() ?? te.date,
            timestamp: te.timestamp?.toISOString?.() ?? te.timestamp,
            data: te.data,
        })),
    } as TalentProfile;
    } catch (err) {
        console.error(`[readTalentCore] Error processing talent ${id}:`, err);
        return null;
    }
}
