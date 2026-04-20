import { form, getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import {
    contact, contactEmail, contactPhone, contactAddress,
    contactRelation, tag, contactTag, locationContact
} from '$lib/server/db/schema';
import { createContactSchema, type Contact } from '$lib/validations/contacts';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { generateContactAssets } from '$lib/server/contacts';
import { listContacts } from '../list.remote';

export const createContact = form(createContactSchema, async (input) => {
    console.log('--- createContact START ---');
    try {
        const user = getAuthenticatedUser();
        ensureAccess(user, 'contacts');
        console.log('User authenticated:', user.id);

        const data = input as any;

        // Parse JSON fields
        let emails = data.emails;
        let phones = data.phones;
        let addresses = data.addresses;
        let relationIds = data.relationIds;
        let tagNames = data.tagNames;
        let locationIds: string[] = [];

        try {
            if (data.emailsJson) emails = JSON.parse(data.emailsJson);
            if (data.phonesJson) phones = JSON.parse(data.phonesJson);
            if (data.addressesJson) addresses = JSON.parse(data.addressesJson);
            if (data.relationsJson) relationIds = JSON.parse(data.relationsJson);
            if (data.tagsJson) tagNames = JSON.parse(data.tagsJson);
            if (data.locationIdsJson) locationIds = JSON.parse(data.locationIdsJson);
        } catch (e) {
            console.error('JSON parsing error:', e);
        }

        // Sanitize contact data
        const { birthday, ...rest } = data.contact;
        const parsedBirthday = (birthday && !isNaN(new Date(birthday).getTime())) ? new Date(birthday) : null;

        const createData = {
            contact: { ...rest, birthday: parsedBirthday },
            emails,
            phones,
            addresses,
            relationIds,
            tagNames,
            locationIds,
        };

        // --- Logic from createContact helper ---
        const contactId = await db.transaction(async (tx) => {
            // Insert main contact
            const [newContact] = await tx.insert(contact).values({
                userId: user.id,
                displayName: createData.contact.displayName,
                givenName: createData.contact.givenName || null,
                familyName: createData.contact.familyName || null,
                middleName: createData.contact.middleName || null,
                honorificPrefix: createData.contact.honorificPrefix || null,
                honorificSuffix: createData.contact.honorificSuffix || null,
                company: createData.contact.company || null,
                role: createData.contact.role || null,
                department: createData.contact.department || null,
                birthday: createData.contact.birthday || null,
                gender: createData.contact.gender || null,
                notes: createData.contact.notes || null,
                isPublic: !!createData.contact.isPublic
            }).returning({ id: contact.id });

            const id = newContact.id;

            // Insert emails
            if (createData.emails && createData.emails.length > 0) {
                await tx.insert(contactEmail).values(createData.emails.map((e: any) => ({
                    contactId: id,
                    value: e.value,
                    type: e.type || 'other',
                    primary: !!e.primary
                })));
            }

            // Insert phones
            if (createData.phones && createData.phones.length > 0) {
                await tx.insert(contactPhone).values(createData.phones.map((p: any) => ({
                    contactId: id,
                    value: p.value,
                    type: p.type || 'other',
                    primary: !!p.primary
                })));
            }

            // Insert addresses
            if (createData.addresses && createData.addresses.length > 0) {
                await tx.insert(contactAddress).values(createData.addresses.map((a: any) => ({
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
                })));
            }

            // Insert relations
            if (createData.relationIds && createData.relationIds.length > 0) {
                await tx.insert(contactRelation).values(createData.relationIds.map((r: any) => ({
                    contactId: id,
                    targetContactId: r.targetContactId,
                    relationType: r.relationType
                })));
            }

            // Insert tags
            if (createData.tagNames && createData.tagNames.length > 0) {
                for (const tagName of createData.tagNames) {
                    let tagId: string;
                    const existingTag = await tx.query.tag.findFirst({ where: (t, { eq }) => eq(t.name, tagName) });
                    if (existingTag) {
                        tagId = existingTag.id;
                    } else {
                        const [newTag] = await tx.insert(tag).values({ name: tagName, userId: user.id }).returning({ id: tag.id });
                        tagId = newTag.id;
                    }
                    await tx.insert(contactTag).values({ contactId: id, tagId });
                }
            }

            // Insert location associations
            if (createData.locationIds && createData.locationIds.length > 0) {
                await tx.insert(locationContact).values(createData.locationIds.map(locationId => ({ locationId, contactId: id })));
            }

            return id;
        });

        // Generate assets after transaction
        let origin: string | undefined;
        try {
            origin = getRequestEvent()?.url.origin;
        } catch (e) { /* ignore */ }
        await generateContactAssets(contactId, origin);

        const newContact = await db.query.contact.findFirst({
            where: (table, { eq }) => eq(table.id, contactId),
            with: {
                emails: true,
                phones: true,
                addresses: true,
                locationAssociations: {
                    with: {
                        location: true
                    }
                },
                relations: {
                    with: {
                        targetContact: true
                    }
                },
                tags: {
                    with: {
                        tag: true
                    }
                }
            }
        });
        if (!newContact) throw new Error("Created contact not found");

        const transformed: Contact = {
            ...newContact,
            createdAt: newContact.createdAt.toISOString(),
            updatedAt: newContact.updatedAt.toISOString(),
            birthday: newContact.birthday ? newContact.birthday.toISOString() : null,
            emails: newContact.emails || [],
            phones: newContact.phones || [],
            addresses: newContact.addresses || [],
            relations: (newContact.relations || []).map((rel: any) => ({
                id: rel.id,
                targetContactId: rel.targetContactId,
                relationType: rel.relationType,
                targetContact: rel.targetContact
            })),
            tags: (newContact.tags || []).map((t: any) => ({
                id: (t as any).tag.id,
                name: (t as any).tag.name
            }))
        } as Contact;

        console.log('--- createContact SUCCESS --- returning contact:', transformed.id);
        await listContacts().refresh();
        return { success: true, id: contactId, contact: transformed };

    } catch (err: any) {
        console.error('--- createContact ERROR ---', err);
        return { success: false, error: { message: err.message || 'Failed to create contact' } };
    }
});

