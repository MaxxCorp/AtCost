import { db } from './db.js';
import {
    contact,
    contactEmail,
    contactPhone,
    contactAddress,
    contactRelation,
    contactTag,
    locationContact,
    eventContact,
    userContact,
    resourceContact,
    announcementContact,
    talent,
    tag,
    location,
    user,
} from './schema/index.js';
import { eq, and, or, inArray, notInArray, not, ilike, sql, exists } from 'drizzle-orm';

function parseFilterValueHelper(val: any): { include: string[]; exclude: string[] } {
    if (!val) return { include: [], exclude: [] };
    if (typeof val === 'string') {
        const trimmed = val.trim();
        return { include: trimmed ? [trimmed] : [], exclude: [] };
    }
    if (Array.isArray(val)) {
        return {
            include: val.filter((item): item is string => typeof item === 'string' && item.trim().length > 0),
            exclude: [],
        };
    }
    if (typeof val === 'object') {
        const inc = val.include ?? val.in;
        const exc = val.exclude ?? val.notIn;
        const toArray = (v: any): string[] => {
            if (!v) return [];
            if (typeof v === 'string') return v.trim() ? [v.trim()] : [];
            if (Array.isArray(v)) return v.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
            return [];
        };
        return {
            include: toArray(inc),
            exclude: toArray(exc),
        };
    }
    return { include: [], exclude: [] };
}

export interface ContactListInput {
    page?: number;
    limit?: number;
    search?: string;
    locationId?: any;
    tagId?: any;
    associatedWith?: {
        type: string;
        id: string;
    };
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
}

export async function listContacts(input?: ContactListInput) {
    const { page = 1, limit = 50, search = '', locationId, tagId, associatedWith, sortField = 'updatedAt', sortOrder = 'desc' } = input || {};
    const offset = (page - 1) * limit;

    let baseQuery = db.select({ id: contact.id }).from(contact).groupBy(contact.id).$dynamic();
    const conditions: any[] = [];

    if (associatedWith) {
        if (associatedWith.type === 'event') {
            baseQuery = baseQuery.innerJoin(eventContact, eq(contact.id, eventContact.contactId)) as any;
            conditions.push(eq(eventContact.eventId, associatedWith.id));
        } else if (associatedWith.type === 'location') {
            baseQuery = baseQuery.innerJoin(locationContact, eq(contact.id, locationContact.contactId)) as any;
            conditions.push(eq(locationContact.locationId, associatedWith.id));
        } else if (associatedWith.type === 'resource') {
            baseQuery = baseQuery.innerJoin(resourceContact, eq(contact.id, resourceContact.contactId)) as any;
            conditions.push(eq(resourceContact.resourceId, associatedWith.id));
        } else if (associatedWith.type === 'announcement') {
            baseQuery = baseQuery.innerJoin(announcementContact, eq(contact.id, announcementContact.contactId)) as any;
            conditions.push(eq(announcementContact.announcementId, associatedWith.id));
        } else if (associatedWith.type === 'user') {
            baseQuery = baseQuery.innerJoin(userContact, eq(contact.id, userContact.contactId)) as any;
            conditions.push(eq(userContact.userId, associatedWith.id));
        } else if (associatedWith.type === 'talent') {
            baseQuery = baseQuery.innerJoin(talent, eq(contact.id, talent.contactId)) as any;
            conditions.push(eq(talent.id, associatedWith.id));
        } else {
            conditions.push(sql`1 = 0`);
        }
    }

    if (search) {
        conditions.push(or(
            ilike(contact.displayName, `%${search}%`),
            ilike(contact.givenName, `%${search}%`),
            ilike(contact.familyName, `%${search}%`),
            ilike(contact.company, `%${search}%`),
            ilike(contact.department, `%${search}%`),
            ilike(contact.role, `%${search}%`),
            ilike(contact.notes, `%${search}%`)
        ));
    }

    if (locationId) {
        const { include, exclude } = parseFilterValueHelper(locationId);
        if (include.length > 0) {
            conditions.push(
                exists(
                    db.select({ id: sql`1` })
                        .from(locationContact)
                        .where(and(eq(locationContact.contactId, contact.id), inArray(locationContact.locationId, include)))
                )
            );
        }
        if (exclude.length > 0) {
            conditions.push(
                not(exists(
                    db.select({ id: sql`1` })
                        .from(locationContact)
                        .where(and(eq(locationContact.contactId, contact.id), inArray(locationContact.locationId, exclude)))
                ))
            );
        }
    }

    if (tagId) {
        const { include, exclude } = parseFilterValueHelper(tagId);
        if (include.length > 0) {
            conditions.push(
                exists(
                    db.select({ id: sql`1` })
                        .from(contactTag)
                        .where(and(eq(contactTag.contactId, contact.id), inArray(contactTag.tagId, include)))
                )
            );
        }
        if (exclude.length > 0) {
            conditions.push(
                not(exists(
                    db.select({ id: sql`1` })
                        .from(contactTag)
                        .where(and(eq(contactTag.contactId, contact.id), inArray(contactTag.tagId, exclude)))
                ))
            );
        }
    }

    if (conditions.length > 0) {
        baseQuery = baseQuery.where(and(...conditions)) as any;
    }

    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult[0]?.count || 0);

    if (total === 0) {
        return { data: [], total: 0 };
    }

    let orderExpression: any;
    if (sortField === 'displayName' || sortField === 'name') {
        const lowerNameSql = sql`lower(coalesce(nullif(${contact.displayName}, ''), nullif(trim(concat(${contact.givenName}, ' ', ${contact.familyName})), ''), ${contact.company}))`;
        orderExpression = sortOrder === 'desc'
            ? sql`${lowerNameSql} desc nulls last`
            : sql`${lowerNameSql} asc nulls last`;
    } else {
        const orderField = sortField === 'createdAt' ? contact.createdAt : contact.updatedAt;
        orderExpression = sortOrder === 'desc' ? sql`${orderField} desc nulls last` : sql`${orderField} asc nulls last`;
    }

    const paginatedIdsResult = await baseQuery
        .orderBy(orderExpression)
        .limit(limit)
        .offset(offset);

    const ids = paginatedIdsResult.map((r: any) => r.id);

    if (ids.length === 0) {
        return { data: [], total };
    }

    const rawResults = await db.query.contact.findMany({
        where: inArray(contact.id, ids),
        with: {
            user: true,
            emails: true,
            phones: true,
            addresses: true,
            locationAssociations: {
                with: { location: true }
            },
            tags: {
                with: { tag: true }
            }
        },
    });

    const rawMap = new Map(rawResults.map((r) => [r.id, r]));
    const sortedResults = ids.map((id) => rawMap.get(id)!).filter(Boolean);

    const data = sortedResults.map((row) => ({
        ...row,
        displayName: row.displayName || '',
        givenName: row.givenName ?? undefined,
        familyName: row.familyName ?? undefined,
        middleName: row.middleName ?? undefined,
        honorificPrefix: row.honorificPrefix ?? undefined,
        honorificSuffix: row.honorificSuffix ?? undefined,
        birthday: row.birthday?.toISOString() ?? undefined,
        gender: row.gender ?? undefined,
        company: row.company ?? undefined,
        department: row.department ?? undefined,
        role: row.role ?? undefined,
        vCardPath: row.vCardPath?.includes('/api/') ? row.vCardPath : `/api/contacts/${row.id}/contact.vcf`,
        qrCodePath: row.qrCodePath?.includes('/api/') ? row.qrCodePath : `/api/contacts/${row.id}/qr.png`,
        notes: row.notes ?? undefined,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        emails: (row.emails || []).map((e: any) => ({
            id: e.id,
            value: e.value,
            type: e.type,
            primary: !!e.primary
        })),
        phones: (row.phones || []).map((p: any) => ({
            id: p.id,
            value: p.value,
            type: p.type,
            primary: !!p.primary
        })),
        addresses: (row.addresses || []).map((a: any) => ({
            id: a.id,
            street: a.street,
            houseNumber: a.houseNumber,
            zip: a.zip,
            city: a.city,
            country: a.country,
            type: a.type
        })),
        locationAssociations: (row.locationAssociations || []).map((la: any) => ({
            id: la.id,
            locationId: la.locationId,
            location: la.location ? {
                id: la.location.id,
                name: la.location.name,
                city: la.location.city
            } : null
        })),
        relations: [],
        tags: (row.tags || []).map((t: any) => ({
            id: t.tag?.id,
            name: t.tag?.name
        })),
    }));

    return { data, total };
}

export async function getContactById(id: string) {
    const result = await db.query.contact.findFirst({
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

    if (!result) return null;

    return {
        ...result,
        displayName: result.displayName || '',
        givenName: result.givenName ?? undefined,
        familyName: result.familyName ?? undefined,
        middleName: result.middleName ?? undefined,
        honorificPrefix: result.honorificPrefix ?? undefined,
        honorificSuffix: result.honorificSuffix ?? undefined,
        birthday: result.birthday?.toISOString() ?? undefined,
        gender: result.gender ?? undefined,
        company: result.company ?? undefined,
        department: result.department ?? undefined,
        role: result.role ?? undefined,
        vCardPath: result.vCardPath?.includes('/api/') ? result.vCardPath : `/api/contacts/${result.id}/contact.vcf`,
        qrCodePath: result.qrCodePath?.includes('/api/') ? result.qrCodePath : `/api/contacts/${result.id}/qr.png`,
        notes: result.notes ?? undefined,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
        emails: (result.emails || []).map((e: any) => ({
            id: e.id,
            value: e.value,
            type: e.type,
            primary: !!e.primary
        })),
        phones: (result.phones || []).map((p: any) => ({
            id: p.id,
            value: p.value,
            type: p.type,
            primary: !!p.primary
        })),
        addresses: (result.addresses || []).map((a: any) => ({
            id: a.id,
            street: a.street,
            houseNumber: a.houseNumber,
            zip: a.zip,
            city: a.city,
            country: a.country,
            type: a.type
        })),
        locationAssociations: (result.locationAssociations || []).map((la: any) => ({
            id: la.id,
            locationId: la.locationId,
            location: la.location ? {
                id: la.location.id,
                name: la.location.name,
                city: la.location.city
            } : null
        })),
        relations: (result.relations || []).map((r: any) => ({
            id: r.id,
            targetContactId: r.targetContactId,
            relationType: r.relationType,
            targetContact: r.targetContact ? {
                id: r.targetContact.id,
                displayName: r.targetContact.displayName
            } : null
        })),
        tags: (result.tags || []).map((t: any) => ({
            id: t.tag?.id,
            name: t.tag?.name
        })),
    };
}

export async function deleteContacts(ids: string[]) {
    if (!Array.isArray(ids) || ids.length === 0) return { count: 0, ids: [] };

    const result = await db.delete(contact)
        .where(inArray(contact.id, ids))
        .returning({ id: contact.id });

    return { count: result.length, ids: result.map((r) => r.id) };
}
