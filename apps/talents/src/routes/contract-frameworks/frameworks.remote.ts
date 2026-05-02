import { query, form, command } from '$app/server';
import { db, desc, and, or, ilike, sql, eq, inArray, contractFramework } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { PaginationSchema, type PaginatedResult } from '@ac/validations/pagination';
import { contractFrameworkSchema } from '@ac/validations/contracts';
import * as v from 'valibot';

export const listContractFrameworks = query(v.optional(PaginationSchema), async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contract-frameworks');

    const { page = 1, limit = 50, search = '' } = input || {};
    const offset = (page - 1) * limit;

    let baseQuery = db.select().from(contractFramework).$dynamic();
    
    if (search) {
        baseQuery = baseQuery.where(
            or(ilike(contractFramework.name, `%${search}%`))
        ) as any;
    }

    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult.rows[0]?.count || 0);

    const rawResults = await baseQuery
        .orderBy(desc(contractFramework.createdAt))
        .limit(limit)
        .offset(offset);

    const data = rawResults.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    }));

    return { data, total };
});

export const readContractFramework = query(v.object({ id: v.string() }), async ({ id }) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contract-frameworks');

    const result = await db.select().from(contractFramework).where(eq(contractFramework.id, id));
    if (result.length === 0) throw new Error('Not found');
    
    return {
        ...result[0],
        createdAt: result[0].createdAt.toISOString(),
        updatedAt: result[0].updatedAt.toISOString(),
    };
});

export const createContractFramework = form(contractFrameworkSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contract-frameworks');

    const [newFramework] = await db.insert(contractFramework).values({
        name: data.name,
        description: data.description || null,
    }).returning();

    await listContractFrameworks().refresh();
    return { success: true, id: newFramework.id, framework: newFramework };
});

export const updateContractFramework = form(v.intersect([v.object({ id: v.string() }), contractFrameworkSchema]), async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contract-frameworks');
    const updateData = data as any;

    const [updatedFramework] = await db.update(contractFramework)
        .set({
            name: updateData.name,
            description: updateData.description || null,
        })
        .where(eq(contractFramework.id, data.id))
        .returning();

    await listContractFrameworks().refresh();
    await readContractFramework({ id: data.id }).set({
        ...updatedFramework,
        createdAt: updatedFramework.createdAt.toISOString(),
        updatedAt: updatedFramework.updatedAt.toISOString(),
    });

    return { success: true, framework: updatedFramework };
});

export const deleteContractFramework = command(v.array(v.string()), async (ids: string[]) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contract-frameworks');

    await db.delete(contractFramework).where(inArray(contractFramework.id, ids));
    await listContractFrameworks().refresh();

    return { success: true };
});
