import { query, form } from '$app/server';
import { db } from '$lib/server/db';
import { talent, talentTimelineEntry, contact, user, contactEmail, contactPhone, contactTag, contactRelation, tag, contactAddress, locationContact } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
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

    return results.map(t => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        availabilityDate: t.availabilityDate?.toISOString(),
        contact: {
            ...t.contact,
            createdAt: t.contact.createdAt.toISOString(),
            updatedAt: t.contact.updatedAt.toISOString(),
            birthday: t.contact.birthday?.toISOString(),
            emails: t.contact.emails || [],
            phones: t.contact.phones || [],
            addresses: t.contact.addresses || [],
            locationAssociations: t.contact.locationAssociations || [],
            tags: t.contact.tags.map(ct => ct.tag.name)
        }
    }));
});

export const readTalent = query(v.string(), async (id) => {
    ensureAccess(getAuthenticatedUser(), 'talents');
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

    return {
        ...result,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
        availabilityDate: result.availabilityDate?.toISOString(),
        contact: {
            ...result.contact,
            createdAt: result.contact.createdAt.toISOString(),
            updatedAt: result.contact.updatedAt.toISOString(),
            birthday: result.contact.birthday?.toISOString(),
            emails: result.contact.emails || [],
            phones: result.contact.phones || [],
            addresses: result.contact.addresses || [],
            locationAssociations: result.contact.locationAssociations || [],
            tags: result.contact.tags.map(ct => ct.tag.name)
        }
    };
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

    await listTalents().refresh();
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

    await readTalent(data.id).refresh();
    await listTalents().refresh();
    return { success: true, id: updatedTalent.id };
});

export const deleteTalent = form(v.string() as any, async (id: any) => {
    ensureAccess(getAuthenticatedUser(), 'talents');
    await db.delete(talent).where(eq(talent.id, id));
    await listTalents().refresh();
    return { success: true };
});

export const bulkDeleteTalents = form(v.array(v.string()) as any, async (ids: any) => {
    ensureAccess(getAuthenticatedUser(), 'talents');
    for (const id of ids) {
        await db.delete(talent).where(eq(talent.id, id));
    }
    await listTalents().refresh();
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

    await readTalent(data.talentId as string).refresh();
    await listTalents().refresh();

    return { success: true, id: newEntry.id };
});

export const upsertTalent = form(unifiedTalentSchema as any, async (data: any) => {
    const authUser = getAuthenticatedUser();
    ensureAccess(authUser, 'talents');

    const { talent: talentData, contact: contactData, emailsJson, phonesJson, relationsJson, tagsJson, addressesJson, locationIdsJson } = data;
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

            return { talentId, contactId };
        });

        await listTalents().refresh();
        if (talentData.id) await readTalent(talentData.id).refresh();
        
        return { success: true, id: result.talentId };
    } catch (err: any) {
        console.error('upsertTalent ERROR:', err);
        return { success: false, error: err.message || 'Upsert failed' };
    }
});

export const getMyTalentProfile = query(v.void_(), async () => {
    const authUser = getAuthenticatedUser();
    if (!authUser) return null;

    // Step 1: Get contact ID for user via userContact association
    // We import userContact at the top now
    const { userContact: ucTable } = await import('@ac/db');
    const uc = await db.select().from(ucTable).where(eq(ucTable.userId, authUser.id)).limit(1);
    if (!uc[0]) return null;

    // Step 2: Use readTalent with the found contact's linked talent
    const t = await db.query.talent.findFirst({
        where: eq(talent.contactId, uc[0].contactId),
    });
    
    if (!t) return null;
    return await readTalent(t.id);
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
