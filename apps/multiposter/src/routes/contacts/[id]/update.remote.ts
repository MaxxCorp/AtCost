import { form, getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import {
    contact, contactEmail, contactPhone, contactAddress,
    contactRelation, tag, contactTag, locationContact
} from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { updateContactSchema, type Contact } from '$lib/validations/contacts';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { generateContactAssets } from '$lib/server/contacts';
import { listContacts } from '../list.remote';
import { readContact } from './read.remote';

export const updateContact = form(updateContactSchema, async (input) => {
    console.log('--- updateContact START ---');
    try {
        const user = getAuthenticatedUser();
        ensureAccess(user, 'contacts');
        console.log('User authenticated:', user.id);

        const anyInput = input as any;
        const { id, data } = anyInput;
        console.log('Update ID:', id);

        // Parse JSON fields from root input
        let emails = data.emails;
        let phones = data.phones;
        let addresses = data.addresses;
        let relationIds = data.relationIds;
        let tagNames = data.tagNames;
        let locationIds: string[] | undefined;

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

        // Sanitize contact data
        let sanitizedContact = undefined;
        if (data.contact) {
            const { birthday, ...rest } = data.contact;
            sanitizedContact = {
                ...rest,
                birthday: birthday === undefined
                    ? undefined
                    : (birthday && !isNaN(new Date(birthday).getTime()))
                        ? new Date(birthday)
                        : null,
            };
        }

        const updateData: Partial<any> = { contact: sanitizedContact, emails, phones, addresses, relationIds, tagNames, locationIds };

        // --- Logic from updateContact helper ---
        await db.transaction(async (tx) => {
            // Update main contact
            if (updateData.contact) {
                const updateSet: any = { updatedAt: new Date() };
                const c = updateData.contact;
                if (c.displayName !== undefined) updateSet.displayName = c.displayName;
                if (c.givenName !== undefined) updateSet.givenName = c.givenName;
                if (c.familyName !== undefined) updateSet.familyName = c.familyName;
                if (c.middleName !== undefined) updateSet.middleName = c.middleName;
                if (c.honorificPrefix !== undefined) updateSet.honorificPrefix = c.honorificPrefix;
                if (c.honorificSuffix !== undefined) updateSet.honorificSuffix = c.honorificSuffix;
                if (c.company !== undefined) updateSet.company = c.company;
                if (c.role !== undefined) updateSet.role = c.role;
                if (c.department !== undefined) updateSet.department = c.department;
                if (c.birthday !== undefined) updateSet.birthday = c.birthday;
                if (c.gender !== undefined) updateSet.gender = c.gender;
                if (c.notes !== undefined) updateSet.notes = c.notes;
                if (c.isPublic !== undefined) updateSet.isPublic = !!c.isPublic;

                await tx.update(contact).set(updateSet).where(eq(contact.id, id));
            }

            // Emails
            if (updateData.emails !== undefined) {
                await tx.delete(contactEmail).where(eq(contactEmail.contactId, id));
                if (updateData.emails.length > 0) {
                    await tx.insert(contactEmail).values(
                        updateData.emails.map((e: any) => ({
                            contactId: id,
                            value: e.value,
                            type: e.type || 'other',
                            primary: !!e.primary
                        }))
                    );
                }
            }

            // Phones
            if (updateData.phones !== undefined) {
                await tx.delete(contactPhone).where(eq(contactPhone.contactId, id));
                if (updateData.phones.length > 0) {
                    await tx.insert(contactPhone).values(
                        updateData.phones.map((p: any) => ({
                            contactId: id,
                            value: p.value,
                            type: p.type || 'other',
                            primary: !!p.primary
                        }))
                    );
                }
            }

            // Addresses
            if (updateData.addresses !== undefined) {
                await tx.delete(contactAddress).where(eq(contactAddress.contactId, id));
                if (updateData.addresses.length > 0) {
                    await tx.insert(contactAddress).values(
                        updateData.addresses.map((a: any) => ({
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
            if (updateData.relationIds !== undefined) {
                const currentRelations = await tx.select().from(contactRelation).where(eq(contactRelation.contactId, id));
                const currentTargetIds = currentRelations.map(r => r.targetContactId);
                const targetRelationIds = updateData.relationIds || [];
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
            if (updateData.tagNames !== undefined) {
                const currentTagAssociations = await tx.query.contactTag.findMany({
                    where: (ct, { eq }) => eq(ct.contactId, id),
                    with: { tag: true }
                });
                const currentTagNames = currentTagAssociations.map(ct => ct.tag.name);
                const targetTagNames = updateData.tagNames || [];

                const toRemove = currentTagAssociations.filter(ct => !targetTagNames.includes(ct.tag.name));
                if (toRemove.length > 0) {
                    await tx.delete(contactTag).where(and(
                        eq(contactTag.contactId, id),
                        inArray(contactTag.tagId, toRemove.map(ct => ct.tagId))
                    ));
                }

                const toAdd = targetTagNames.filter((name: string) => !currentTagNames.includes(name));
                for (const tagName of toAdd) {
                    let tagId: string;
                    const existingTag = await tx.query.tag.findFirst({
                        where: (t, { eq }) => eq(t.name, tagName)
                    });
                    if (existingTag) {
                        tagId = existingTag.id;
                    } else {
                        const [newTag] = await tx.insert(tag).values({ name: tagName, userId: user.id }).returning({ id: tag.id });
                        tagId = newTag.id;
                    }
                    await tx.insert(contactTag).values({ contactId: id, tagId });
                }
            }

            // Locations
            if (updateData.locationIds !== undefined) {
                await tx.delete(locationContact).where(eq(locationContact.contactId, id));
                if (updateData.locationIds.length > 0) {
                    await tx.insert(locationContact).values(
                        updateData.locationIds.map((locationId: string) => ({
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

        const updated = await db.query.contact.findFirst({
            where: (table, { eq }) => eq(table.id, id),
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
        if (!updated) throw new Error("Updated contact not found");

        const transformed: Contact = {
            ...updated,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
            birthday: updated.birthday ? updated.birthday.toISOString() : null,
            emails: updated.emails || [],
            phones: updated.phones || [],
            addresses: updated.addresses || [],
            relations: (updated.relations || []).map((rel: any) => ({
                id: rel.id,
                targetContactId: rel.targetContactId,
                relationType: rel.relationType,
                targetContact: rel.targetContact
            })),
            tags: (updated.tags || []).map((t: any) => ({
                id: (t as any).tag.id,
                name: (t as any).tag.name
            }))
        } as Contact;

        console.log('--- updateContact SUCCESS ---');
        await listContacts().refresh();
        return { success: true, contact: transformed };

    } catch (err: any) {
        console.error('--- updateContact ERROR ---', err);
        return { success: false, error: { message: err.message || 'Update failed' } };
    }
});

