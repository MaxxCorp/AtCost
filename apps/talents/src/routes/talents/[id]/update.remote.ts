import { form } from '$app/server';
import { db, talent, talentTimelineEntry, contact, user, contactEmail, contactPhone, contactTag, contactRelation, tag, contactAddress, locationContact, userContact, userTalent, eq, desc, inArray, sql } from '$lib/server/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { unifiedTalentSchema } from '@ac/validations';
import { readTalent } from './read.remote';
import { listTalents } from '../list.remote';

export const updateTalent = form(unifiedTalentSchema, async (data): Promise<{ success: boolean; id?: string; error?: string }> => {
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
                    await tx.insert(userContact).values({ userId: linkedUserId, contactId }).onConflictDoNothing();
                }
            }

            // 5. Link User Account (userTalent)
            if (linkedUserId !== undefined) {
                await tx.delete(userTalent).where(eq(userTalent.talentId, talentId));
                if (linkedUserId) {
                    await tx.insert(userTalent).values({ userId: linkedUserId, talentId }).onConflictDoNothing();
                }
            }

            return { talentId };
        });

        await readTalent(result.talentId).refresh();
        await listTalents().refresh();

        return { success: true, id: result.talentId };
    } catch (err: any) {
        return { success: false, error: err.message || 'Update failed' };
    }
});
