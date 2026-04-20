import { query } from '$app/server';
import { db, talent, talentTimelineEntry, contact, user, contactEmail, contactPhone, contactTag, contactRelation, tag, contactAddress, locationContact, userContact, userTalent, eq, desc, inArray, and, sql } from '$lib/server/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';

export const readTalent = query(v.string(), async (id: string) => {
    const authUser = getAuthenticatedUser();
    ensureAccess(authUser, 'talents');

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

    if (!result) return null;

    // Resolve linked user
    let linkedUser: { id: string; name: string; email: string } | null = null;
    
    const uc = await db.select({ userId: userContact.userId })
        .from(userContact)
        .where(eq(userContact.contactId, result.contact.id))
        .limit(1);
    
    let userId = uc[0]?.userId;
    
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
        createdAt: result.createdAt?.toISOString?.() ?? result.createdAt,
        updatedAt: result.updatedAt?.toISOString?.() ?? result.updatedAt,
        linkedUser,
        contact: {
            ...result.contact,
            birthday: result.contact.birthday?.toISOString() ?? null,
            createdAt: result.contact.createdAt?.toISOString() ?? result.contact.createdAt,
            updatedAt: result.contact.updatedAt?.toISOString() ?? result.contact.updatedAt,
            relations: (result.contact.relations || []).map((r: any) => ({
                id: r.id,
                targetContactId: r.targetContactId,
                relationType: r.relationType,
                targetContact: r.targetContact
            })),
            tags: (result.contact.tags || []).map((ct: any) => ct.tag?.name).filter(Boolean)
        },
        timelineEntries: (result.timelineEntries || []).map((te: any) => ({
            ...te,
            date: te.date?.toISOString?.() ?? te.date,
            timestamp: te.timestamp?.toISOString?.() ?? te.timestamp,
        })),
    };
});
