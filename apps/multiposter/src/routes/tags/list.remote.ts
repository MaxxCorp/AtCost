import { query } from '$app/server';
import { db, tag, tagCategory, inArray, notInArray, isNull, sql, ilike, eq, and, or } from '@ac/db';
import { tagPaginationSchema, parseFilterValue } from '@ac/validations';
import type * as v from 'valibot';
import { ensureDefaultCategoriesAndTags } from '#lib/server/tags/service.js';
import { getOptionalUser, hasAccess } from '#lib/server/authorization.js';

export const listTags = query(tagPaginationSchema, async (input: v.InferOutput<typeof tagPaginationSchema>) => {
    const user = getOptionalUser();
    const isAuthorized = Boolean(
        user && (
            hasAccess(user, 'tags') ||
            hasAccess(user, 'events') ||
            hasAccess(user, 'announcements') ||
            hasAccess(user, 'contacts') ||
            hasAccess(user, 'locations') ||
            hasAccess(user, 'resources') ||
            hasAccess(user, 'kiosks') ||
            hasAccess(user, 'recipes') ||
            hasAccess(user, 'consumables')
        )
    );

    if (isAuthorized) {
        await ensureDefaultCategoriesAndTags();
    }

    const { page = 1, limit = 50, search = '', sortField = 'name', sortOrder = 'asc', visibility, categoryId } = input || {};
    const offset = (page - 1) * limit;

    let baseQuery = db.select({ id: tag.id }).from(tag).$dynamic();
    const conditions = [];

    // Unauthenticated / unauthorized callers can ONLY see external tags
    if (!isAuthorized) {
        conditions.push(eq(tag.visibility, 'external'));
    }
    
    if (search.trim()) {
        conditions.push(
            or(
                ilike(tag.name, `%${search}%`),
                ilike(tag.description, `%${search}%`)
            )
        );
    }

    if (visibility && isAuthorized) {
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

    if (total === 0) {
        return { data: [], total: 0 };
    }

    let orderField: any = tag.name;
    if (sortField === 'createdAt') orderField = tag.createdAt;

    const orderExpression = sortOrder === 'desc' ? sql`${orderField} desc nulls last` : sql`${orderField} asc nulls last`;

    const paginatedIdsResult = await baseQuery
        .orderBy(orderExpression)
        .limit(limit)
        .offset(offset);

    const ids = paginatedIdsResult.map((r: any) => r.id);

    if (ids.length === 0) {
        return { data: [], total };
    }

    const rawResults = await db.query.tag.findMany({
        where: inArray(tag.id, ids),
        orderBy: [orderExpression],
        with: {
            ...(isAuthorized ? { user: true } : {}),
            category: true,
        }
    });

    const data = rawResults.map((row) => {
        if (!isAuthorized) {
            return {
                id: row.id,
                name: row.name,
                visibility: 'external' as const,
                color: row.color,
                description: row.description,
                categoryId: row.categoryId,
                category: row.category,
                createdAt: row.createdAt.toISOString()
            };
        }
        return {
            ...row,
            createdAt: row.createdAt.toISOString()
        };
    });

    return { data: data as any, total };
});
