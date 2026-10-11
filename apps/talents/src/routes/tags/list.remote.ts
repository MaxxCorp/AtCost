import { query } from '$app/server';
import { db, tag, tagCategory, eq, and, or, ilike, asc, desc, sql, inArray } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { tagPaginationSchema } from '@ac/validations';
import { ensureDefaultCategoriesAndTags } from '#lib/server/tags/service.js';

export const listTags = query(tagPaginationSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'talents');

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
        conditions.push(eq(tag.visibility, visibility as any));
    }

    if (categoryId) {
        conditions.push(eq(tag.categoryId, categoryId));
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
