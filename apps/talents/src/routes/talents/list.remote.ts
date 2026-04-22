import { query } from '$app/server';
import { db, talent, contact, eq, desc, inArray, ilike, or, and, sql, talentTimelineEntry, userContact, user } from '$lib/server/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { talentPaginationSchema as PaginationSchema, type PaginatedResult } from '@ac/validations';

export const listTalents = query(PaginationSchema, async (input): Promise<PaginatedResult<any>> => {
    const authUser = getAuthenticatedUser();
    ensureAccess(authUser, 'talents');

    const { page = 1, limit = 50, search = '', tagId, locationId, status } = input || {};
    const offset = (page - 1) * limit;

    let baseQuery = db.select({ id: talent.id }).from(talent);
    
    const conditions: any[] = [];
    if (search) {
        conditions.push(or(
            ilike(talent.jobTitle || '', `%${search}%`),
            ilike(talent.status || '', `%${search}%`)
        ));
    }

    if (status) {
        const ids = Array.isArray(status) ? status : [status];
        conditions.push(inArray(talent.status, ids as any));
    }

    if (tagId) {
        const { contactTag } = await import('@ac/db');
        const ids = Array.isArray(tagId) ? tagId : [tagId];
        baseQuery = baseQuery.innerJoin(contact, eq(contact.id, talent.contactId))
                     .innerJoin(contactTag, eq(contactTag.contactId, talent.contactId)) as any;
        conditions.push(inArray(contactTag.tagId, ids));
    }

    if (locationId) {
        const { locationContact } = await import('@ac/db');
        const ids = Array.isArray(locationId) ? locationId : [locationId];
        if (!tagId) baseQuery = baseQuery.innerJoin(contact, eq(contact.id, talent.contactId)) as any;
        baseQuery = baseQuery.innerJoin(locationContact, eq(locationContact.contactId, talent.contactId)) as any;
        conditions.push(inArray(locationContact.locationId, ids));
    }

    if (conditions.length > 0) {
        baseQuery = baseQuery.where(and(...conditions as any)) as any;
    }

    baseQuery = baseQuery.groupBy(talent.id) as any;

    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult[0]?.count || 0);

    if (total === 0) return { data: [], total: 0 };

    const talentsWithId = await baseQuery
        .orderBy(desc(talent.updatedAt))
        .limit(limit)
        .offset(offset);
        
    const ids = talentsWithId.map(t => t.id);

    const rawTalents = await db.query.talent.findMany({
        where: inArray(talent.id, ids),
        with: {
            contact: {
                with: {
                    emails: true,
                    phones: true,
                    addresses: true,
                    locationAssociations: { with: { location: true } },
                    tags: { with: { tag: true } }
                }
            },
            timelineEntries: {
                orderBy: [desc(talentTimelineEntry.timestamp)],
                limit: 3
            }
        }
    });

    const untransformedResults = ids.map(id => rawTalents.find(rt => rt.id === id)!).filter(Boolean);

    // Resolve linked users
    const contactIds = untransformedResults.filter(t => t.contact != null).map(t => t.contact.id);
    const userLinks = contactIds.length > 0
        ? await db.select({ contactId: userContact.contactId, userId: userContact.userId })
            .from(userContact)
            .where(inArray(userContact.contactId, contactIds))
        : [];
    const linkedUsers = userLinks.length > 0
        ? await db.select({ id: user.id, name: user.name, email: user.email })
            .from(user)
            .where(inArray(user.id, userLinks.map(ul => ul.userId)))
        : [];

    const userByContactId = new Map<string, { id: string; name: string; email: string }>();
    for (const ul of userLinks) {
        const u = linkedUsers.find(lu => lu.id === ul.userId);
        if (u) userByContactId.set(ul.contactId, u);
    }

    const data = untransformedResults.filter(t => t.contact != null).map(t => ({
        id: t.id,
        contactId: t.contactId,
        status: t.status,
        jobTitle: t.jobTitle,
        salaryExpectation: t.salaryExpectation,
        availabilityDate: t.availabilityDate?.toISOString() ?? null,
        onboardingStatus: t.onboardingStatus,
        resumeUrl: t.resumeUrl,
        source: t.source,
        internalNotes: t.internalNotes,
        createdAt: t.createdAt?.toISOString?.() ?? t.createdAt,
        updatedAt: t.updatedAt?.toISOString?.() ?? t.updatedAt,
        linkedUser: userByContactId.get(t.contact.id) ?? null,
        contact: {
            ...t.contact,
            birthday: t.contact.birthday?.toISOString() ?? null,
            createdAt: t.contact.createdAt?.toISOString() ?? t.contact.createdAt,
            updatedAt: t.contact.updatedAt?.toISOString() ?? t.contact.updatedAt,
            tags: (t.contact.tags || []).map((ct: any) => ({
                id: ct.tag?.id,
                name: ct.tag?.name
            })).filter((tag: any) => tag.name)
        }
    }));

    return { data, total };
});
