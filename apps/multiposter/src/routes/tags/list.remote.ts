import { query } from '$app/server';
import { db, tag, inArray, sql, ilike, eq, and, or } from '@ac/db';
import { tagPaginationSchema } from '@ac/validations';
import type * as v from 'valibot';
import { ensureDefaultCategoriesAndTags } from '#lib/server/tags/service.js';

export const listTags = query(tagPaginationSchema, async (input: v.InferOutput<typeof tagPaginationSchema>) => {
    await ensureDefaultCategoriesAndTags();

    const { page = 1, limit = 50, search = '', sortField = 'name', sortOrder = 'asc', visibility, categoryId } = input || {};
    const offset = (page - 1) * limit;

    let baseQuery = db.select({ id: tag.id }).from(tag).$dynamic();
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
            user: true,
            category: true,
        }
    });

    const data = rawResults.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString()
    }));

    return { data, total };
});
