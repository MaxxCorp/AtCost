import { query } from '$app/server';
import { db } from '@ac/db';
import { tag } from '@ac/db';
import { inArray, sql, ilike } from '@ac/db';
import { tagPaginationSchema as PaginationSchema } from '@ac/validations';
import type * as v from 'valibot';

export const listTags = query(PaginationSchema, async (input: v.InferOutput<typeof PaginationSchema>) => {
    const { page = 1, limit = 50, search = '', sortField = 'createdAt', sortOrder = 'desc' } = input || {};
    const offset = (page - 1) * limit;

    let baseQuery = db.select({ id: tag.id }).from(tag).$dynamic();
    
    if (search) {
        baseQuery = baseQuery.where(ilike(tag.name, `%${search}%`)) as any;
    }

    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult[0]?.count || 0);

    if (total === 0) {
        return { data: [], total: 0 };
    }

    let orderField: any = tag.createdAt;
    if (sortField === 'name') orderField = tag.name;

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
            user: true
        }
    });

    const data = rawResults.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString()
    }));

    return { data, total };
});
