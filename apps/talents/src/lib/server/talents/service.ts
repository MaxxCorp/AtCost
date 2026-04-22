import { db, talent, talentTimelineEntry, contact, user, contactEmail, contactPhone, contactTag, contactRelation, tag, contactAddress, locationContact, userContact, userTalent, eq, desc, inArray, and, sql } from '$lib/server/db';
// Unifying Drizzle operators via $lib/server/db

export interface TalentProfile {
    id: string;
    contactId: string;
    status: string;
    jobTitle: string | null;
    salaryExpectation: string | null;
    availabilityDate: string | null;
    onboardingStatus: string | null;
    resumeUrl: string | null;
    source: string | null;
    internalNotes: string | null;
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

    // Resolve linked user
    let linkedUser: { id: string; name: string; email: string } | null = null;
    
    // Check userContact (implicit)
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

    // NEW: Step 3: Global email fallback if no link found yet
    if (!linkedUser) {
        const emails = result.contact.emails.map(e => e.value.toLowerCase());
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
        jobTitle: result.jobTitle,
        salaryExpectation: result.salaryExpectation,
        availabilityDate: result.availabilityDate?.toISOString() ?? null,
        onboardingStatus: result.onboardingStatus,
        resumeUrl: result.resumeUrl,
        source: result.source,
        internalNotes: result.internalNotes,
        createdAt: result.createdAt?.toISOString?.() ?? (result.createdAt instanceof Date ? result.createdAt.toISOString() : result.createdAt),
        updatedAt: result.updatedAt?.toISOString?.() ?? (result.updatedAt instanceof Date ? result.updatedAt.toISOString() : result.updatedAt),
        linkedUser,
        contact: {
            id: result.contact.id,
            displayName: result.contact.displayName,
            givenName: result.contact.givenName,
            familyName: result.contact.familyName,
            company: result.contact.company,
            role: result.contact.role,
            department: result.contact.department,
            birthday: result.contact.birthday?.toISOString() ?? null,
            notes: result.contact.notes,
            isPublic: result.contact.isPublic,
            createdAt: result.contact.createdAt?.toISOString?.() ?? (result.contact.createdAt instanceof Date ? result.contact.createdAt.toISOString() : result.contact.createdAt),
            updatedAt: result.contact.updatedAt?.toISOString?.() ?? (result.contact.updatedAt instanceof Date ? result.contact.updatedAt.toISOString() : result.contact.updatedAt),
            emails: result.contact.emails || [],
            phones: result.contact.phones || [],
            addresses: result.contact.addresses || [],
            locationAssociations: result.contact.locationAssociations || [],
            relations: (result.contact.relations || []).map((r: any) => ({
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
            tags: (result.contact.tags || []).map((ct: any) => ({
                id: ct.tag?.id,
                name: ct.tag?.name
            })).filter((t: any) => t.name)
        },
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
