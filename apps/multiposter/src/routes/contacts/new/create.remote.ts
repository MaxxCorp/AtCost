import { form } from '$app/server';
import { createContact, getContact } from '$lib/server/contacts';
import { listContacts } from '../list.remote';
import { createContactSchema, type Contact } from '$lib/validations/contacts';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';

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
            // Continue with potentially unparsed or default values, or throw?
            // Usually unparsed strings won't match schema for arrays, so it might fail later.
        }

        console.log('Parsed complex fields:', { emails, phones, addresses, relationIds, tagNames });

        // Sanitize contact data
        const {
            birthday,
            ...rest
        } = data.contact;

        const parsedBirthday = (birthday && !isNaN(new Date(birthday).getTime())) ? new Date(birthday) : null;
        console.log('Parsed birthday:', parsedBirthday);

        const contactId = await createContact({
            contact: {
                ...rest,
                birthday: parsedBirthday,
            } as any,
            emails,
            phones,
            addresses,
            relationIds,
            tagNames,
            locationIds,
        });

        const newContact = await getContact(contactId);
        if (!newContact) throw new Error("Created contact not found");

        // Transform the same way as listContacts
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

        console.log('--- createNewContact SUCCESS --- returning contact:', transformed.id);
        return { success: true, id: contactId, contact: transformed };

    } catch (err: any) {
        console.error('--- createNewContact ERROR ---', err);
        return { success: false, error: { message: err.message || 'Failed to create contact' } };
    }
});
