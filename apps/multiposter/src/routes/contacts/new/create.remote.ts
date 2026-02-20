import { form } from '$app/server';
import { generateContactAssets } from '$lib/server/contacts';
import { db } from '$lib/server/db';
import { contact, contactEmail, contactPhone, contactAddress, contactRelation, tag, contactTag, locationContact } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getRequestEvent } from '$app/server';
import { listContacts } from '../list.remote';
import { createContactSchema } from '$lib/validations/contacts';
import { getAuthenticatedUser, ensureAccess } from '$lib/authorization';
import { readContact } from '../[id]/read.remote';
import { error } from '@sveltejs/kit';

export const createNewContact = form(createContactSchema, async (input) => {
    console.log('--- createNewContact START ---');
    try {
        const user = getAuthenticatedUser();
        ensureAccess(user, 'contacts');
        console.log('User authenticated:', user.id);

        const data = input as any;
        console.log('Raw input data:', JSON.stringify(data, null, 2));

        // Parse JSON fields commonly used to bypass FormData nesting issues
        let emails = data.emails;
        let phones = data.phones;
        let addresses = data.addresses;
        let relationIds = data.relationIds;
        let tagNames = data.tagNames;
        let locationIds = data.locationIds;

        if (data.emailsJson) emails = JSON.parse(data.emailsJson);
        if (data.phonesJson) phones = JSON.parse(data.phonesJson);
        if (data.addressesJson) addresses = JSON.parse(data.addressesJson);
        if (data.relationsJson) relationIds = JSON.parse(data.relationsJson);
        if (data.tagsJson) tagNames = JSON.parse(data.tagsJson);
        if (data.locationIdsJson) locationIds = JSON.parse(data.locationIdsJson);


        console.log('Parsed complex fields:', { emails, phones, addresses, relationIds, tagNames, locationIds });

        // Sanitize contact data
        const {
            birthday,
            ...rest
        } = data.contact;

        const parsedBirthday = (birthday && !isNaN(new Date(birthday).getTime())) ? new Date(birthday) : null;
        console.log('Parsed birthday:', parsedBirthday);

        const contactId = await db.transaction(async (tx) => {
            // Insert main contact
            const [newContact] = await tx.insert(contact).values({
                userId: user.id,
                displayName: rest.displayName,
                givenName: rest.givenName || null,
                familyName: rest.familyName || null,
                middleName: rest.middleName || null,
                honorificPrefix: rest.honorificPrefix || null,
                honorificSuffix: rest.honorificSuffix || null,
                birthday: parsedBirthday || null,
                gender: rest.gender || null,
                notes: rest.notes || null,
                isPublic: rest.isPublic || false
            }).returning({ id: contact.id });

            const id = newContact.id;

            // Insert emails
            if (emails && emails.length > 0) {
                const emailsToInsert = emails.map((e: any) => ({
                    contactId: id,
                    value: e.value,
                    type: e.type || 'other',
                    primary: !!e.primary
                }));
                await tx.insert(contactEmail).values(emailsToInsert);
            }

            // Insert phones
            if (phones && phones.length > 0) {
                const phonesToInsert = phones.map((p: any) => ({
                    contactId: id,
                    value: p.value,
                    type: p.type || 'other',
                    primary: !!p.primary
                }));
                await tx.insert(contactPhone).values(phonesToInsert);
            }

            // Insert addresses
            if (addresses && addresses.length > 0) {
                const addressesToInsert = addresses.map((a: any) => ({
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
                }));
                await tx.insert(contactAddress).values(addressesToInsert);
            }

            // Insert relations
            if (relationIds && relationIds.length > 0) {
                const relationsToInsert = relationIds.map((r: any) => ({
                    contactId: id,
                    targetContactId: r.targetContactId,
                    relationType: r.relationType
                }));
                await tx.insert(contactRelation).values(relationsToInsert);
            }

            // Insert tags
            if (tagNames && tagNames.length > 0) {
                for (const tagName of tagNames) {
                    // Find or create tag
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

            // Insert location associations
            if (locationIds && locationIds.length > 0) {
                const locationAssociations = locationIds.map((locationId: any) => ({
                    locationId,
                    contactId: id
                }));
                await tx.insert(locationContact).values(locationAssociations);
            }

            return id;
        });

        // Generate assets after transaction
        let origin: string | undefined;
        try {
            origin = getRequestEvent()?.url.origin;
        } catch (e) { /* ignore */ }
        await generateContactAssets(contactId, origin);

        console.log('Contact created with ID:', contactId);


        await listContacts().refresh();


        const newContact = await db.query.contact.findFirst({
            where: (table, { eq }) => eq(table.id, contactId),
            with: {
                emails: true,
                phones: true,
                addresses: true,
                relations: {
                    with: {
                        targetContact: true
                    }
                },
                tags: {
                    with: {
                        tag: true
                    }
                },
                locationAssociations: {
                    with: {
                        location: true
                    }
                }
            }
        });

        if (!newContact) {
            error(500, 'Failed to find created contact');
        }

        await readContact(newContact.id).set(newContact);

        console.log('--- createNewContact SUCCESS ---');
        return { success: true, contact: newContact, id: contactId };

    } catch (err: any) {
        console.error('--- createNewContact ERROR ---', err);
        return { success: false, error: { message: err.message || 'Failed to create contact' } };
    }
});
