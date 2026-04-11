import { query, form } from '$app/server';
import { db } from '$lib/server/db';
import { talent, talentTimelineEntry, contact, user, contactEmail, contactPhone, contactTag, contactRelation, tag, contactAddress, locationContact, userContact, userTalent } from '@ac/db';
import { getAuthenticatedUser, ensureAccess, getOptionalUser } from '$lib/server/authorization';
import { createTalentSchema, updateTalentSchema, talentTimelineEntrySchema, unifiedTalentSchema } from '@ac/validations';
import { eq, desc, inArray } from 'drizzle-orm';
import * as v from 'valibot';

export const listTalents = query(v.void_(), async () => {
    ensureAccess(getAuthenticatedUser(), 'talents');
    const results = await db.query.talent.findMany({
        with: {
            contact: {
                with: {
                    emails: true,
                    phones: true,
                    addresses: true,
                    locationAssociations: { with: { location: true } },
                    tags: { with: { tag: true } }
                }
            },
            timelineEntries: {
                orderBy: [desc(talentTimelineEntry.timestamp)],
                limit: 3
            }
        },
        orderBy: [desc(talent.updatedAt)]
    });
    console.info(`[listTalents] DB returned ${results.length} talents.`);


    // Resolve linked users for each talent's contact
    const contactIds = results.filter(t => t.contact != null).map(t => t.contact.id);
    const userLinks = contactIds.length > 0
        ? await db.select({ contactId: userContact.contactId, userId: userContact.userId })
            .from(userContact)
            .where(inArray(userContact.contactId, contactIds))
        : [];
    const linkedUsers = userLinks.length > 0
        ? await db.select({ id: user.id, name: user.name, email: user.email })
            .from(user)
            .where(inArray(user.id, userLinks.map(ul => ul.userId)))
        : [];

    const userByContactId = new Map<string, { id: string; name: string; email: string }>();
    for (const ul of userLinks) {
        const u = linkedUsers.find(lu => lu.id === ul.userId);
        if (u) userByContactId.set(ul.contactId, u);
    }

    return results.filter(t => t.contact != null).map(t => ({
        id: t.id,
        contactId: t.contactId,
        status: t.status,
        jobTitle: t.jobTitle,
        salaryExpectation: t.salaryExpectation,
        availabilityDate: t.availabilityDate?.toISOString() ?? null,
        onboardingStatus: t.onboardingStatus,
        resumeUrl: t.resumeUrl,
        source: t.source,
        internalNotes: t.internalNotes,
        createdAt: t.createdAt?.toISOString?.() ?? (t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt),
        updatedAt: t.updatedAt?.toISOString?.() ?? (t.updatedAt instanceof Date ? t.updatedAt.toISOString() : t.updatedAt),
        linkedUser: userByContactId.get(t.contact.id) ?? null,
        contact: {
            id: t.contact.id,
            displayName: t.contact.displayName,
            givenName: t.contact.givenName,
            familyName: t.contact.familyName,
            company: t.contact.company,
            role: t.contact.role,
            department: t.contact.department,
            birthday: t.contact.birthday?.toISOString() ?? null,
            notes: t.contact.notes,
            isPublic: t.contact.isPublic,
            createdAt: t.contact.createdAt?.toISOString?.() ?? (t.contact.createdAt instanceof Date ? t.contact.createdAt.toISOString() : t.contact.createdAt),
            updatedAt: t.contact.updatedAt?.toISOString?.() ?? (t.contact.updatedAt instanceof Date ? t.contact.updatedAt.toISOString() : t.contact.updatedAt),
            emails: t.contact.emails || [],
            phones: t.contact.phones || [],
            addresses: t.contact.addresses || [],
            locationAssociations: (t.contact.locationAssociations || []).map((la: any) => ({
                locationId: la.locationId,
                contactId: la.contactId,
                location: la.location ? {
                    id: la.location.id,
                    name: la.location.name,
                    roomId: la.location.roomId,
                } : null,
            })),
            tags: (t.contact.tags || []).map((ct: any) => ct.tag?.name).filter(Boolean)
        },
        timelineEntries: (t.timelineEntries || []).map((te: any) => ({
            id: te.id,
            type: te.type,
            title: te.title,
            description: te.description,
            date: te.date?.toISOString?.() ?? te.date,
            timestamp: te.timestamp?.toISOString?.() ?? te.timestamp,
            data: te.data,
        })),
    }));
});

const readTalentCore = async (id: string) => {
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
            tags: (result.contact.tags || []).map((ct: any) => ct.tag?.name).filter(Boolean)
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
    };
};

export const readTalent = query(v.string(), async (id) => {
    ensureAccess(getAuthenticatedUser(), 'talents');
    return await readTalentCore(id);
});


export const createTalent = form(createTalentSchema, async (data) => {
    const authUser = getAuthenticatedUser();
    ensureAccess(authUser, 'talents');

    const [newTalent] = await db.insert(talent).values({
        contactId: data.contactId,
        status: data.status,
        jobTitle: data.jobTitle,
        salaryExpectation: data.salaryExpectation,
        availabilityDate: data.availabilityDate ? new Date(data.availabilityDate) : null,
        onboardingStatus: data.onboardingStatus,
        resumeUrl: data.resumeUrl,
        source: data.source,
        internalNotes: data.internalNotes,
    } as any).returning();

    listTalents().refresh();
    return { success: true, id: newTalent.id };
});

export const updateTalent = form(updateTalentSchema as any, async (data: any) => {
    const authUser = getAuthenticatedUser();
    ensureAccess(authUser, 'talents');

    const [updatedTalent] = await db.update(talent).set({
        contactId: data.contactId,
        status: data.status,
        jobTitle: data.jobTitle,
        salaryExpectation: data.salaryExpectation,
        availabilityDate: data.availabilityDate ? new Date(data.availabilityDate) : null,
        onboardingStatus: data.onboardingStatus,
        resumeUrl: data.resumeUrl,
        source: data.source,
        internalNotes: data.internalNotes,
    } as any).where(eq(talent.id, data.id)).returning();

    readTalent(data.id).refresh();
    listTalents().refresh();
    return { success: true, id: updatedTalent.id };
});

export const deleteTalent = form(v.string() as any, async (id: any) => {
    ensureAccess(getAuthenticatedUser(), 'talents');
    await db.delete(talent).where(eq(talent.id, id));
    listTalents().refresh();
    return { success: true };
});

export const bulkDeleteTalents = form(v.array(v.string()) as any, async (ids: any) => {
    ensureAccess(getAuthenticatedUser(), 'talents');
    for (const id of ids) {
        await db.delete(talent).where(eq(talent.id, id));
    }
    listTalents().refresh();
    return { success: true };
});

export const addTimelineEntry = form(v.object({
    talentId: v.string(),
    entry: talentTimelineEntrySchema
}), async (data: any) => {
    const authUser = getAuthenticatedUser();
    ensureAccess(authUser, 'talents');

    const entry = data.entry as v.InferOutput<typeof talentTimelineEntrySchema>;

    const [newEntry] = await db.insert(talentTimelineEntry).values({
        talentId: data.talentId as string,
        type: entry.type as "Interview" | "Hiring" | "Evaluation" | "Termination",
        description: entry.description,
        addedByUserId: authUser.id,
        timestamp: new Date(entry.date),
        data: {
            date: entry.date,
            comment: entry.comment,
            nextStep: entry.nextStep
        }
    } as any).returning();

    readTalent(data.talentId as string).refresh();
    listTalents().refresh();

    return { success: true, id: newEntry.id };
});

export const upsertTalent = form(unifiedTalentSchema as any, async (data: any) => {
    const authUser = getAuthenticatedUser();
    ensureAccess(authUser, 'talents');

    const { talent: talentData, contact: contactData, emailsJson, phonesJson, relationsJson, tagsJson, addressesJson, locationIdsJson, linkedUserId } = data;
    const emails = emailsJson ? JSON.parse(emailsJson) : [];
    const phones = phonesJson ? JSON.parse(phonesJson) : [];
    const relations = relationsJson ? JSON.parse(relationsJson) : [];
    const tags = tagsJson ? JSON.parse(tagsJson) : [];
    const addresses = addressesJson ? JSON.parse(addressesJson) : [];
    const locationIds = locationIdsJson ? JSON.parse(locationIdsJson) : [];

    try {
        const result = await db.transaction(async (tx) => {
            // 1. Upsert Contact
            let contactId = contactData.id;
            const contactValues = {
                userId: authUser.id,
                displayName: contactData.displayName,
                givenName: contactData.givenName,
                familyName: contactData.familyName,
                birthday: contactData.birthday ? new Date(contactData.birthday) : null,
                role: contactData.role,
                department: contactData.department,
                notes: contactData.notes,
                updatedAt: new Date(),
            };

            if (contactId) {
                await tx.update(contact).set(contactValues).where(eq(contact.id, contactId));
            } else {
                const [newContact] = await tx.insert(contact).values(contactValues).returning();
                contactId = newContact.id;
            }

            // 2. Sync Contact Sub-entities
            await tx.delete(contactEmail).where(eq(contactEmail.contactId, contactId));
            if (emails.length > 0) {
                await tx.insert(contactEmail).values(emails.map((e: any) => ({ ...e, contactId })));
            }

            await tx.delete(contactPhone).where(eq(contactPhone.contactId, contactId));
            if (phones.length > 0) {
                await tx.insert(contactPhone).values(phones.map((p: any) => ({ ...p, contactId })));
            }

            await tx.delete(contactRelation).where(eq(contactRelation.contactId, contactId));
            if (relations.length > 0) {
                await tx.insert(contactRelation).values(relations.map((r: any) => ({
                    contactId,
                    targetContactId: r.targetContactId,
                    relationType: r.relationType
                })));
            }

            await tx.delete(contactTag).where(eq(contactTag.contactId, contactId));
            if (tags.length > 0) {
                for (const tagName of tags) {
                    let [existingTag] = await tx.select().from(tag).where(eq(tag.name, tagName)).limit(1);
                    if (!existingTag) {
                        [existingTag] = await tx.insert(tag).values({ name: tagName, userId: authUser.id }).returning();
                    }
                    await tx.insert(contactTag).values({ contactId, tagId: existingTag.id });
                }
            }

            await tx.delete(contactAddress).where(eq(contactAddress.contactId, contactId));
            if (addresses.length > 0) {
                await tx.insert(contactAddress).values(addresses.map((a: any) => ({ ...a, contactId })));
            }

            await tx.delete(locationContact).where(eq(locationContact.contactId, contactId));
            if (locationIds.length > 0) {
                await tx.insert(locationContact).values(locationIds.map((lid: string) => ({ 
                    locationId: lid,
                    contactId
                })));
            }

            // 3. Upsert Talent
            let talentId = talentData.id;
            const talentValues = {
                contactId,
                status: talentData.status,
                jobTitle: talentData.jobTitle,
                salaryExpectation: talentData.salaryExpectation,
                availabilityDate: talentData.availabilityDate ? new Date(talentData.availabilityDate) : null,
                onboardingStatus: talentData.onboardingStatus,
                resumeUrl: talentData.resumeUrl,
                source: talentData.source,
                internalNotes: talentData.internalNotes,
                updatedAt: new Date(),
            };

            if (talentId) {
                await tx.update(talent).set(talentValues).where(eq(talent.id, talentId));
            } else {
                const [newTalent] = await tx.insert(talent).values(talentValues).returning();
                talentId = newTalent.id;
            }

            // 4. Link User Account (userContact)
            await tx.delete(userContact).where(eq(userContact.contactId, contactId));
            if (linkedUserId) {
                await tx.insert(userContact).values({
                    userId: linkedUserId,
                    contactId,
                }).onConflictDoNothing();
            }

            return { talentId, contactId };
        });

        listTalents().refresh();
        if (talentData.id) readTalent(talentData.id).refresh();
        
        return { success: true, id: result.talentId };
    } catch (err: any) {
        console.error('upsertTalent ERROR:', err);
        return { success: false, error: err.message || 'Upsert failed' };
    }
});

export const getMyTalentProfile = query(v.void_(), async () => {
    const authUser = getOptionalUser();
    if (!authUser) {
        console.warn('[getMyTalentProfile] No authenticated user found.');
        return null;
    }

    // Step 1: Explicit association via userTalent
    const ut = await db.select().from(userTalent).where(eq(userTalent.userId, authUser.id)).limit(1);
    if (ut[0]) {
        const profile = await readTalentCore(ut[0].talentId);
        if (profile) return profile;
    }

    // Step 2: Implicit association via contact email
    const uc = await db.select().from(userContact).where(eq(userContact.userId, authUser.id)).limit(1);
    if (uc[0]) {
        console.info(`[getMyTalentProfile] Trying implicit link via contact: ${uc[0].contactId}`);
        const t = await db.query.talent.findFirst({
            where: eq(talent.contactId, uc[0].contactId),
        });
        if (t) {
            console.info(`[getMyTalentProfile] Found implicit userContact link to talent: ${t.id}`);
            const profile = await readTalentCore(t.id);
            if (profile) return profile;
        }
    }

    console.warn(`[getMyTalentProfile] No talent association found for user: ${authUser.id}`);
    return null;
});

export const listEmployees = query(v.void_(), async () => {
    ensureAccess(getAuthenticatedUser(), 'talents');
    // Filter contacts by tag "Employee"
    const results = await db.query.contact.findMany({
        with: {
            tags: {
                with: { tag: true }
            }
        }
    });

    return results.filter(c => c.tags.some(ct => ct.tag.name === 'Employee')).map(c => ({
        id: c.id,
        displayName: c.displayName || `${c.givenName} ${c.familyName}`
    }));
});

export const listSystemUsers = query(v.void_(), async () => {
    ensureAccess(getAuthenticatedUser(), 'talents');
    const results = await db.select({
        id: user.id,
        name: user.name,
        email: user.email,
    }).from(user).orderBy(user.name);
    return results;
});
