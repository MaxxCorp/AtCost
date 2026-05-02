import { query, form, command } from '$app/server';
import { db, talent, talentTimelineEntry, contact, user, contactEmail, contactPhone, contactTag, contactRelation, tag, contactAddress, locationContact, userContact, userTalent, eq, desc, inArray, sql } from '@ac/db';
import { getAuthenticatedUser, ensureAccess, getOptionalUser } from '$lib/server/authorization';
import {
    talentTimelineEntrySchema,
    unifiedTalentSchema,
    talentPaginationSchema as PaginationSchema,
    type PaginatedResult
} from '@ac/validations';
import * as v from 'valibot';
import { readTalent as readTalentService, type TalentProfile } from '$lib/server/talents/service';
import { listTalents } from './list.remote';
import { readTalent } from './[id]/read.remote';

export const bulkDeleteTalents = command(v.array(v.string()), async (ids): Promise<{ success: boolean }> => {
    ensureAccess(getAuthenticatedUser(), 'talents');
    for (const id of ids) {
        await db.delete(talent).where(eq(talent.id, id));
    }
    await (listTalents as any).refresh();
    return { success: true };
});

const addTimelineEntryHandler = async (data: {
    talentId: string,
    entry: v.InferInput<typeof talentTimelineEntrySchema>
}): Promise<{ success: boolean; id: string }> => {
    const authUser = getAuthenticatedUser();
    ensureAccess(authUser, 'talents');

    const entry = data.entry;

    const [newEntry] = await db.insert(talentTimelineEntry).values({
        talentId: data.talentId,
        type: entry.type as "Interview" | "Hiring" | "Evaluation" | "Termination",
        title: entry.type,
        date: new Date(entry.date),
        description: entry.description,
        addedByUserId: authUser.id,
        timestamp: new Date(entry.date),
        data: {
            date: entry.date,
            comment: entry.comment,
            nextStep: entry.nextStep
        }
    }).returning();

    await (readTalent(data.talentId) as any).refresh();
    return { success: true, id: newEntry.id };
};

export const addTimelineEntry = form(v.object({
    talentId: v.string(),
    entry: talentTimelineEntrySchema
}), addTimelineEntryHandler);

export const invokeAddTimelineEntry = command(v.object({
    talentId: v.string(),
    entry: talentTimelineEntrySchema
}), addTimelineEntryHandler);


export const upsertTalent = form(unifiedTalentSchema, async (data): Promise<{ success: boolean; id?: string; error?: string }> => {
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
            if (linkedUserId !== undefined) {
                await tx.delete(userContact).where(eq(userContact.contactId, contactId));
                if (linkedUserId) {
                    await tx.insert(userContact).values({
                        userId: linkedUserId,
                        contactId,
                    }).onConflictDoNothing();
                }
            }

            // 5. Link User Account (userTalent)
            if (linkedUserId !== undefined) {
                await tx.delete(userTalent).where(eq(userTalent.talentId, talentId));
                if (linkedUserId) {
                    await tx.insert(userTalent).values({
                        userId: linkedUserId,
                        talentId,
                    }).onConflictDoNothing();
                }
            }

            return { talentId, contactId };
        });

        // Refresh the detail view and list to ensure client-side data is in sync
        if (result.talentId) {
            void readTalent(result.talentId).refresh();
        }
        void listTalents().refresh();

        return { success: true, id: result.talentId };
    } catch (err: any) {
        console.error('upsertTalent ERROR:', err);
        return { success: false, error: err.message || 'Upsert failed' };
    }
});

export const getMyTalentProfile = query(v.undefined_(), async (): Promise<TalentProfile | null> => {
    const authUser = getOptionalUser();
    if (!authUser) {
        console.warn('[getMyTalentProfile] No authenticated user found in locals.');
        return null;
    }

    // Step 1: Explicit association via userTalent
    try {
        const ut = await db.select().from(userTalent).where(eq(userTalent.userId, authUser.id)).limit(1);
        if (ut[0]) {
            const profile = await readTalentService(ut[0].talentId);
            if (profile) return profile;
        }
    } catch (e) {
        console.error('[getMyTalentProfile] Error in Step 1 (userTalent):', e);
    }

    // Step 2: Implicit association via userContact joined with talent
    try {
        const talentLink = await db.select({ talentId: talent.id })
            .from(userContact)
            .innerJoin(talent, eq(talent.contactId, userContact.contactId))
            .where(eq(userContact.userId, authUser.id))
            .limit(1);

        if (talentLink[0]) {
            console.log('[getMyTalentProfile] Step 2 match found:', talentLink[0].talentId);
            const profile = await readTalentService(talentLink[0].talentId);
            if (profile) return profile;
        }
    } catch (e) {
        console.error('[getMyTalentProfile] Error in Step 2 (userContact):', e);
    }

    // Step 2.5: Direct association via contact.userId ownership
    try {
        const directContactLink = await db.select({ talentId: talent.id })
            .from(talent)
            .innerJoin(contact, eq(contact.id, talent.contactId))
            .where(eq(contact.userId, authUser.id))
            .limit(1);

        if (directContactLink[0]) {
            console.log('[getMyTalentProfile] Step 2.5 (ownership) match found:', directContactLink[0].talentId);
            const profile = await readTalentService(directContactLink[0].talentId);
            if (profile) return profile;
        }
    } catch (e) {
        console.error('[getMyTalentProfile] Error in Step 2.5 (contact ownership):', e);
    }

    // Step 3: Fallback association via email match
    if (authUser.email) {
        try {
            const emailMatch = await db.select({ talentId: talent.id })
                .from(talent)
                .innerJoin(contact, eq(talent.contactId, contact.id))
                .innerJoin(contactEmail, eq(contact.id, contactEmail.contactId))
                .where(eq(sql`LOWER(${contactEmail.value})`, authUser.email.toLowerCase()))
                .limit(1);

            if (emailMatch[0]) {
                const profile = await readTalentService(emailMatch[0].talentId);
                if (profile) return profile;
            }
        } catch (e) {
            console.error('[getMyTalentProfile] Error in Step 3 (email):', e);
        }
    }

    console.warn(`[getMyTalentProfile] No talent profile found for user ${authUser.id} (${authUser.email})`);
    return null;
});

export const listEmployees = query(v.undefined_(), async (): Promise<any[]> => {
    ensureAccess(getAuthenticatedUser(), 'talents');
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

export const listSystemUsers = query(v.undefined_(), async (): Promise<any[]> => {
    ensureAccess(getAuthenticatedUser(), 'talents');
    return await db.select({
        id: user.id,
        name: user.name,
        email: user.email,
    }).from(user).orderBy(desc(user.createdAt));
});

export const listTags = query(PaginationSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

    // Using a more robust way to get tag for tags search
    const results = await db.select({
        id: tag.id,
        name: tag.name
    }).from(tag);

    return { data: results, total: results.length };
});
