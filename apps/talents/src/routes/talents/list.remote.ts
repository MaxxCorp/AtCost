import * as v from 'valibot';
import { type InferSelectModel, db, desc } from '$lib/server/db';
import { query } from '$app/server';
import { contact } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';

export type Contact = Omit<InferSelectModel<typeof contact>, 'createdAt' | 'updatedAt' | 'birthday'> & {
    createdAt: string;
    updatedAt: string;
    birthday: string | null;
    emails?: any[];
    phones?: any[];
    addresses?: any[];
    locationAssociations?: any[];
    relations?: any[];
    tags?: any[];
};

export const listContacts = query(v.undefined_(), async (): Promise<Contact[]> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contacts');

    const rawResults = await db
        .select()
        .from(contact)
        .orderBy(desc(contact.createdAt));

    const results = rawResults.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        birthday: row.birthday ? row.birthday.toISOString() : null,
    }));

    const contactsWithRelations = await Promise.all(results.map(async (c) => {
        const contactData = await db.query.contact.findFirst({
            where: (table: any, { eq }: any) => eq(table.id, c.id) as any,
            with: {
                emails: true,
                phones: true,
                addresses: true,
                relations: {
                    with: {
                        targetContact: true
                    }
                },
                locationAssociations: {
                    with: {
                        location: true
                    }
                },
                tags: {
                    with: {
                        tag: true
                    }
                }
            }
        });

        if (!contactData) return c as Contact;

        return {
            ...c,
            emails: contactData.emails,
            phones: contactData.phones,
            addresses: contactData.addresses,
            locationAssociations: contactData.locationAssociations,
            relations: (contactData.relations || []).map(r => ({
                id: r.id,
                targetContactId: r.targetContactId,
                relationType: r.relationType,
                targetContact: r.targetContact
            })),
            tags: (contactData.tags || []).map(t => ({
                id: t.tag.id,
                name: t.tag.name
            })),
        } as Contact;
    }));

    return contactsWithRelations;
});
