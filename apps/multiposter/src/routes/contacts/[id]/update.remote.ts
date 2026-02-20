import { form } from '$app/server';
import { generateContactAssets } from '$lib/server/contacts';
import { db } from '$lib/server/db';
import { contact, contactEmail, contactPhone, contactAddress, contactRelation, tag, contactTag, locationContact } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getRequestEvent } from '$app/server';
import { listContacts } from '../list.remote';
import { readContact } from './read.remote';
import { updateContactSchema } from '$lib/validations/contacts';
import { getAuthenticatedUser, ensureAccess } from '$lib/authorization';

export const updateExistingContact = form(updateContactSchema, async (input) => {
    console.log('--- updateExistingContact START ---');
    try {
        const user = getAuthenticatedUser();
        ensureAccess(user, 'contacts');
        console.log('User authenticated:', user.id);

        const anyInput = input as any;
        const { id, data } = anyInput;
        console.log('Update ID:', id);
        console.log('Update Data:', JSON.stringify(data, null, 2));

        // Parse JSON fields from root input
        let emails = data.emails;
        let phones = data.phones;
        let addresses = data.addresses;
        let relationIds = data.relationIds;
        let tagNames = data.tagNames;
        let locationIds = data.locationIds;

        try {
            if (anyInput.emailsJson) emails = JSON.parse(anyInput.emailsJson);
            if (anyInput.phonesJson) phones = JSON.parse(anyInput.phonesJson);
            if (anyInput.addressesJson) addresses = JSON.parse(anyInput.addressesJson);
            if (anyInput.relationsJson) relationIds = JSON.parse(anyInput.relationsJson);
            if (anyInput.tagsJson) tagNames = JSON.parse(anyInput.tagsJson);
            if (anyInput.locationIdsJson) locationIds = JSON.parse(anyInput.locationIdsJson);
        } catch (e) {
            console.error('JSON parsing error:', e);
        }

        console.log('Parsed complex fields:', { emails, phones, addresses, relationIds, tagNames, locationIds });

        // Sanitize contact data to exclude immutable metadata that might cause type errors (strings vs Dates)
        let sanitizedContact = undefined;
        if (data.contact) {
            const {
                birthday,
                ...rest
            } = data.contact;

            sanitizedContact = {
                ...rest,
                birthday: birthday === undefined
                    ? undefined
                    : (birthday && !isNaN(new Date(birthday).getTime()))
                        ? new Date(birthday)
                        : null,
            };
        }

        console.log('Calling updateContact helper...');
        console.log('Calling updateContact logic...');
        // Inline updateContact logic
        await db.transaction(async (tx) => {
            // Update main contact
            if (sanitizedContact) {
                const updateSet: any = {
                    updatedAt: new Date()
                };
                if (sanitizedContact.displayName !== undefined) updateSet.displayName = sanitizedContact.displayName;
                if (sanitizedContact.givenName !== undefined) updateSet.givenName = sanitizedContact.givenName;
                if (sanitizedContact.familyName !== undefined) updateSet.familyName = sanitizedContact.familyName;
                if (sanitizedContact.middleName !== undefined) updateSet.middleName = sanitizedContact.middleName;
                if (sanitizedContact.honorificPrefix !== undefined) updateSet.honorificPrefix = sanitizedContact.honorificPrefix;
                if (sanitizedContact.honorificSuffix !== undefined) updateSet.honorificSuffix = sanitizedContact.honorificSuffix;
                if (sanitizedContact.birthday !== undefined) updateSet.birthday = sanitizedContact.birthday;
                if (sanitizedContact.gender !== undefined) updateSet.gender = sanitizedContact.gender;
                if (sanitizedContact.notes !== undefined) updateSet.notes = sanitizedContact.notes;
                if (sanitizedContact.isPublic !== undefined) updateSet.isPublic = sanitizedContact.isPublic;

                const query = tx.update(contact).set(updateSet);
                await query.where(eq(contact.id, id));
            }

            // Emails
            if (emails !== undefined) {
                await tx.delete(contactEmail).where(eq(contactEmail.contactId, id));

                if (emails.length > 0) {
                    await tx.insert(contactEmail).values(
                        emails.map((e: any) => ({
                            contactId: id,
                            value: e.value,
                            type: e.type || 'other',
                            primary: !!e.primary
                        }))
                    );
                }
            }

            // Phones
            if (phones !== undefined) {
                await tx.delete(contactPhone).where(eq(contactPhone.contactId, id));

                if (phones.length > 0) {
                    await tx.insert(contactPhone).values(
                        phones.map((p: any) => ({
                            contactId: id,
                            value: p.value,
                            type: p.type || 'other',
                            primary: !!p.primary
                        }))
                    );
                }
            }

            // Addresses
            if (addresses !== undefined) {
                // Addresses are harder to diff by value, so we'll stick to delete-reinsert but only if they changed
                await tx.delete(contactAddress).where(eq(contactAddress.contactId, id));
                const targetAddresses = addresses || [];
                if (targetAddresses.length > 0) {
                    await tx.insert(contactAddress).values(
                        targetAddresses.map((a: any) => ({
                            contactId: id,
                            street: a.street || null,
                            houseNumber: a.houseNumber || null,
                            addressSuffix: a.addressSuffix || null,
                            zip: a.zip || null,
                            city: a.city || null,
                            state: a.state || null,
                            country: a.country || null,
                            type: a.type || 'other',
                            primary: !!a.primary
                        }))
                    );
                }
            }

            // Relations
            if (relationIds !== undefined) {
                const currentRelations = await tx.select().from(contactRelation).where(eq(contactRelation.contactId, id));
                const currentTargetIds = currentRelations.map(r => r.targetContactId);

                const targetRelationIds = relationIds || [];
                const targetIds = targetRelationIds.map((r: any) => r.targetContactId);

                const toDelete = currentRelations.filter(r => !targetIds.includes(r.targetContactId));
                if (toDelete.length > 0) {
                    await tx.delete(contactRelation).where(and(
                        eq(contactRelation.contactId, id),
                        inArray(contactRelation.targetContactId, toDelete.map(r => r.targetContactId))
                    ));
                }

                const toAdd = targetRelationIds.filter((r: any) => !currentTargetIds.includes(r.targetContactId));
                if (toAdd.length > 0) {
                    await tx.insert(contactRelation).values(
                        toAdd.map((r: any) => ({
                            contactId: id,
                            targetContactId: r.targetContactId,
                            relationType: r.relationType
                        }))
                    );
                }
            }

            // Tags
            if (tagNames !== undefined) {
                const currentTagAssociations = await tx.query.contactTag.findMany({
                    where: (ct, { eq }) => eq(ct.contactId, id),
                    with: { tag: true }
                });
                const currentTagNames = currentTagAssociations.map(ct => ct.tag.name);
                const targetTagNames = tagNames || [];

                // Delete removed tags
                const toRemove = currentTagAssociations.filter(ct => !targetTagNames.includes(ct.tag.name));
                if (toRemove.length > 0) {
                    await tx.delete(contactTag).where(and(
                        eq(contactTag.contactId, id),
                        inArray(contactTag.tagId, toRemove.map(ct => ct.tagId))
                    ));
                }

                // Add new tags
                const toAdd = targetTagNames.filter((name: any) => !currentTagNames.includes(name));
                for (const tagName of toAdd) {
                    let tagId: string;
                    const existingTag = await tx.query.tag.findFirst({
                        where: (t, { eq }) => eq(t.name, tagName)
                    });

                    if (existingTag) {
                        tagId = existingTag.id;
                    } else {
                        const [newTag] = await tx.insert(tag).values({
                            name: tagName,
                            userId: user.id
                        }).returning({ id: tag.id });
                        tagId = newTag.id;
                    }

                    await tx.insert(contactTag).values({
                        contactId: id,
                        tagId
                    });
                }
            }

            // Location Associations
            if (locationIds !== undefined) {
                // Sync location associations
                await tx.delete(locationContact).where(eq(locationContact.contactId, id));

                if (locationIds.length > 0) {
                    await tx.insert(locationContact).values(
                        locationIds.map((locationId: any) => ({
                            locationId,
                            contactId: id
                        }))
                    );
                }
            }
        });

        // Re-generate assets
        let origin: string | undefined;
        try {
            origin = getRequestEvent()?.url.origin;
        } catch (e) { /* ignore */ }
        await generateContactAssets(id, origin);

        const result = id;

        console.log('Update result:', result);

        await readContact(id).refresh();
        await listContacts().refresh();

        console.log('--- updateExistingContact SUCCESS ---');
        return { success: true, contact: result };

    } catch (err: any) {
        console.error('--- updateExistingContact ERROR ---', err);
        return { success: false, error: { message: err.message || 'Update failed' } };
    }
});
