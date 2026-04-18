import { form } from '$app/server';
import { db, contact, contactEmail, contactPhone, contactTag, contactRelation, tag, locationContact, talent } from '$lib/server/db';
import { listContacts } from '../list.remote';
import { listTalents } from '../talents.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { createContactSchema } from '@ac/validations/contacts';
import { eq } from '$lib/server/db';

export const createNewContact = form(createContactSchema, async (data): Promise<{ success: boolean; id?: string; contact?: any; error?: { message: string } }> => {
    try {
        const user = getAuthenticatedUser();
        ensureAccess(user, 'contacts');

        const { contact: contactFields, emailsJson, phonesJson, relationsJson, tagsJson, locationIdsJson } = data;

        const emails = emailsJson ? JSON.parse(emailsJson) : [];
        const phones = phonesJson ? JSON.parse(phonesJson) : [];
        const relations = relationsJson ? JSON.parse(relationsJson) : [];
        const tags = tagsJson ? JSON.parse(tagsJson) : [];
        const locationIds = locationIdsJson ? JSON.parse(locationIdsJson) : [];

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
                await tx.insert(locationContact).values(locationIds.map((lId: string) => ({
                    contactId: newContact.id,
                    locationId: lId
                })));
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

            await tx.insert(talent).values({
                contactId: newContact.id,
                status: 'applicant'
            });

            return newContact;
        });

        return { success: true, id: result.id, contact: result };
    } catch (err: any) {
        console.error('createNewContact ERROR:', err);
        return { success: false, error: { message: err.message || 'Creation failed' } };
    }
});
