import { query } from '$app/server';
import { db, desc, and, or, ilike, sql, contact } from '$lib/server/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { PaginationSchema, type Contact, type PaginatedResult } from '@ac/validations';
import * as v from 'valibot';



export const listContacts = query(PaginationSchema, async (input): Promise<PaginatedResult<Contact>> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contacts');

    const { page = 1, limit = 50, search = '' } = input || {};
    const offset = (page - 1) * limit;

    let baseQuery = db.select().from(contact).$dynamic();
    
    const conditions: any[] = [];
    if (search) {
        conditions.push(or(
            ilike(contact.givenName, `%${search}%`),
            ilike(contact.familyName, `%${search}%`)
        ));
    }
    if (conditions.length > 0) {
        baseQuery = baseQuery.where(and(...conditions as any)) as any;
    }

    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult[0]?.count || 0);

    const rawResults = await baseQuery
        .orderBy(desc(contact.createdAt))
        .limit(limit)
        .offset(offset);

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

    return { data: contactsWithRelations, total };
});
