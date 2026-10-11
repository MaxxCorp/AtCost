import { query } from '$app/server';
import { db, tag, tagCategory, eq, and, or, ilike, asc, desc, sql, inArray, notInArray, isNull } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { tagPaginationSchema, parseFilterValue } from '@ac/validations';
import { ensureDefaultCategoriesAndTags } from '#lib/server/tags/service.js';

export const listTags = query(tagPaginationSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'tags');

    await ensureDefaultCategoriesAndTags();

    const { page = 1, limit = 100, search = '', visibility, categoryId } = input || {};
    const offset = (page - 1) * limit;

    let baseQuery = db.select().from(tag).$dynamic();
    const conditions = [];

    if (search.trim()) {
        conditions.push(
            or(
                ilike(tag.name, `%${search}%`),
                ilike(tag.description, `%${search}%`)
            )
        );
    }

    if (visibility) {
        const { include, exclude } = parseFilterValue(visibility);
        if (include.length > 0) {
            conditions.push(inArray(tag.visibility, include as any));
        }
        if (exclude.length > 0) {
            conditions.push(notInArray(tag.visibility, exclude as any));
        }
    }

    if (categoryId) {
        const { include, exclude } = parseFilterValue(categoryId);
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (include.length > 0) {
            const uuidIncludes = include.filter((id) => uuidRegex.test(id));
            const nameIncludes = include.filter((id) => !uuidRegex.test(id));
            if (nameIncludes.length > 0) {
                const matchedCats = await db
                    .select({ id: tagCategory.id })
                    .from(tagCategory)
                    .where(
                        or(
                            inArray(tagCategory.name, nameIncludes),
                            inArray(tagCategory.slug, nameIncludes)
                        )
                    );
                uuidIncludes.push(...matchedCats.map((c) => c.id));
            }
            if (uuidIncludes.length > 0) {
                conditions.push(inArray(tag.categoryId, uuidIncludes));
            } else {
                conditions.push(sql`1 = 0`);
            }
        }

        if (exclude.length > 0) {
            const uuidExcludes = exclude.filter((id) => uuidRegex.test(id));
            const nameExcludes = exclude.filter((id) => !uuidRegex.test(id));
            if (nameExcludes.length > 0) {
                const matchedCats = await db
                    .select({ id: tagCategory.id })
                    .from(tagCategory)
                    .where(
                        or(
                            inArray(tagCategory.name, nameExcludes),
                            inArray(tagCategory.slug, nameExcludes)
                        )
                    );
                uuidExcludes.push(...matchedCats.map((c) => c.id));
            }
            if (uuidExcludes.length > 0) {
                conditions.push(or(notInArray(tag.categoryId, uuidExcludes), isNull(tag.categoryId)));
            }
        }
    }

    if (conditions.length > 0) {
        baseQuery = baseQuery.where(and(...conditions as any)) as any;
    }

    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult[0]?.count || 0);

    if (total === 0) return { data: [], total: 0 };

    const rawResults = await baseQuery
        .orderBy(asc(tag.name))
        .limit(limit)
        .offset(offset);

    // Fetch related categories for these tags
    const categoryIds = rawResults.map(r => r.categoryId).filter(Boolean) as string[];
    let categoryMap = new Map<string, any>();
    if (categoryIds.length > 0) {
        const cats = await db.query.tagCategory.findMany({
            where: inArray(tagCategory.id, categoryIds),
        });
        for (const c of cats) {
            categoryMap.set(c.id, c);
        }
    }

    const data = rawResults.map(row => ({
        ...row,
        category: row.categoryId ? categoryMap.get(row.categoryId) || null : null,
        createdAt: row.createdAt.toISOString(),
    }));

    return { data, total };
});
