import { form } from '$app/server';
import { db } from '$lib/server/db';
import { contact, contactEmail, contactPhone, contactTag, locationContact, contactRelation, tag } from '$lib/server/db/schema';
import { listContacts } from '../list.remote';
import { readContact } from './read.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { updateContactSchema } from '@ac/validations/contacts';
import { eq, inArray } from 'drizzle-orm';

export const updateExistingContact = form(updateContactSchema, async (data) => {
    try {
        const user = getAuthenticatedUser();
        ensureAccess(user, 'contacts');

        const { id, data: updateData, emailsJson, phonesJson, locationIdsJson, relationsJson, tagsJson } = data;
        console.log('[SERVER] updateExistingContact:', id, {
            hasEmails: !!emailsJson,
            hasPhones: !!phonesJson,
            locationIdsJson,
            hasRelations: !!relationsJson,
            hasTags: !!tagsJson
        });

        const contactFields = updateData.contact || {};

        const emails = emailsJson ? JSON.parse(emailsJson) : [];
        const phones = phonesJson ? JSON.parse(phonesJson) : [];
        const locationIds = locationIdsJson ? JSON.parse(locationIdsJson) : [];
        console.log('[SERVER] Parsed locationIds:', locationIds);
        const relations = relationsJson ? JSON.parse(relationsJson) : [];
        const tags = tagsJson ? JSON.parse(tagsJson) : [];

        await db.transaction(async (tx) => {
            const updateSet: any = {
                updatedAt: new Date(),
            };
            if (contactFields.displayName !== undefined) updateSet.displayName = contactFields.displayName;
            if (contactFields.givenName !== undefined) updateSet.givenName = contactFields.givenName;
            if (contactFields.familyName !== undefined) updateSet.familyName = contactFields.familyName;
            if (contactFields.honorificPrefix !== undefined) updateSet.honorificPrefix = contactFields.honorificPrefix;
            if (contactFields.honorificSuffix !== undefined) updateSet.honorificSuffix = contactFields.honorificSuffix;
            if (contactFields.notes !== undefined) updateSet.notes = contactFields.notes;
            if (contactFields.isPublic !== undefined) {
                updateSet.isPublic = typeof contactFields.isPublic === 'string' ? contactFields.isPublic === 'true' : !!contactFields.isPublic;
            }
            if (contactFields.birthday !== undefined) {
                updateSet.birthday = contactFields.birthday ? new Date(contactFields.birthday) : null;
            }

            await tx.update(contact).set(updateSet).where(eq(contact.id, id));

            // Sync emails
            await tx.delete(contactEmail).where(eq(contactEmail.contactId, id));
            if (emails.length > 0) {
                await tx.insert(contactEmail).values(emails.map((e: any) => ({ ...e, contactId: id })));
            }

            // Sync phones
            await tx.delete(contactPhone).where(eq(contactPhone.contactId, id));
            if (phones.length > 0) {
                await tx.insert(contactPhone).values(phones.map((p: any) => ({ ...p, contactId: id })));
            }

            // Sync locations
            await tx.delete(locationContact).where(eq(locationContact.contactId, id));
            if (locationIds.length > 0) {
                await tx.insert(locationContact).values(locationIds.map((locId: string) => ({
                    contactId: id,
                    locationId: locId
                })));
            }



            // Sync relations
            await tx.delete(contactRelation).where(eq(contactRelation.contactId, id));
            if (relations.length > 0) {
                await tx.insert(contactRelation).values(relations.map((r: any) => ({
                    contactId: id,
                    targetContactId: r.targetContactId,
                    relationType: r.relationType
                })));
            }

            // Sync tags
            await tx.delete(contactTag).where(eq(contactTag.contactId, id));
            if (tags.length > 0) {
                for (const tagName of tags) {
                    let [existingTag] = await tx.select().from(tag).where(eq(tag.name, tagName)).limit(1);
                    if (!existingTag) {
                        [existingTag] = await tx.insert(tag).values({ name: tagName, userId: user.id }).returning();
                    }
                    await tx.insert(contactTag).values({ contactId: id, tagId: existingTag.id });
                }
            }
        });

        await readContact(id).refresh();
        await listContacts().refresh();

        return { success: true };
    } catch (err: any) {
        console.error('updateExistingContact ERROR:', err);
        return { success: false, error: { message: err.message || 'Update failed' } };
    }
});
