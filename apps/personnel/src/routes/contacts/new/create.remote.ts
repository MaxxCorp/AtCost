import { form } from '$app/server';
import { db } from '$lib/server/db';
import { contact, contactEmail, contactPhone, contactTag, locationContact, contactRelation, tag } from '$lib/server/db/schema';
import { listContacts } from '../list.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { createContactSchema } from '@ac/validations/contacts';
import { eq } from 'drizzle-orm';

export const createNewContact = form(createContactSchema, async (data) => {
    try {
        const user = getAuthenticatedUser();
        ensureAccess(user, 'contacts');

        const { contact: contactFields, emailsJson, phonesJson, locationIdsJson, relationsJson, tagsJson } = data;

        const emails = emailsJson ? JSON.parse(emailsJson) : [];
        const phones = phonesJson ? JSON.parse(phonesJson) : [];
        const locationIds = locationIdsJson ? JSON.parse(locationIdsJson) : [];
        const relations = relationsJson ? JSON.parse(relationsJson) : [];
        const tags = tagsJson ? JSON.parse(tagsJson) : [];

        const result = await db.transaction(async (tx) => {
            const [newContact] = await tx.insert(contact).values({
                displayName: contactFields.displayName,
                givenName: contactFields.givenName,
                familyName: contactFields.familyName,
                honorificPrefix: contactFields.honorificPrefix,
                honorificSuffix: contactFields.honorificSuffix,
                notes: contactFields.notes,
                isPublic: typeof contactFields.isPublic === 'string' ? contactFields.isPublic === 'true' : !!contactFields.isPublic,
                userId: user.id,
                birthday: contactFields.birthday ? new Date(contactFields.birthday) : null,
            }).returning();

            if (emails.length > 0) {
                await tx.insert(contactEmail).values(emails.map((e: any) => ({ ...e, contactId: newContact.id })));
            }
            if (phones.length > 0) {
                await tx.insert(contactPhone).values(phones.map((p: any) => ({ ...p, contactId: newContact.id })));
            }
            if (locationIds.length > 0) {
                await tx.insert(locationContact).values(locationIds.map((lid: string) => ({ contactId: newContact.id, locationId: lid })));
            }
            if (relations.length > 0) {
                await tx.insert(contactRelation).values(relations.map((r: any) => ({
                    contactId: newContact.id,
                    targetContactId: r.targetContactId,
                    relationType: r.relationType
                })));
            }
            if (tags.length > 0) {
                for (const tagName of tags) {
                    let [existingTag] = await tx.select().from(tag).where(eq(tag.name, tagName)).limit(1);
                    if (!existingTag) {
                        [existingTag] = await tx.insert(tag).values({ name: tagName, userId: user.id }).returning();
                    }
                    await tx.insert(contactTag).values({ contactId: newContact.id, tagId: existingTag.id });
                }
            }

            return newContact;
        });

        await listContacts().refresh();
        return { success: true, id: result.id, contact: result };
    } catch (err: any) {
        console.error('createNewContact ERROR:', err);
        return { success: false, error: { message: err.message || 'Creation failed' } };
    }
});
