import { query, form, command } from '$app/server';
import { db, desc, and, or, ilike, sql, eq, inArray } from '@ac/db';
import { contract, contractFrameworkContract } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { PaginationSchema, type PaginatedResult } from '@ac/validations/pagination';
import { contractPaginationSchema, contractSchema } from '@ac/validations/contracts';
import * as v from 'valibot';

export const listContracts = query(contractPaginationSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contracts');

    const { page = 1, limit = 50, search = '', talentId, frameworkId } = input || {};
    const offset = (page - 1) * limit;

    let baseQuery = db.select({ id: contract.id }).from(contract).$dynamic();
    
    const conditions = [];
    if (talentId) {
        const ids = Array.isArray(talentId) ? talentId : [talentId];
        conditions.push(inArray(contract.talentId, ids));
    }
    
    if (frameworkId) {
        const ids = Array.isArray(frameworkId) ? frameworkId : [frameworkId];
        baseQuery = baseQuery.innerJoin(contractFrameworkContract, eq(contractFrameworkContract.contractId, contract.id)) as any;
        conditions.push(inArray(contractFrameworkContract.frameworkId, ids));
    }

    if (search) {
        conditions.push(or(ilike(contract.entgeltgruppe, `%${search}%`), ilike(contract.wageType, `%${search}%`)));
    }

    if (conditions.length > 0) {
        baseQuery = baseQuery.where(and(...conditions as any)) as any;
    }

    // Deduplicate
    baseQuery = baseQuery.groupBy(contract.id) as any;

    const { sql } = await import('drizzle-orm');
    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult.rows[0]?.count || 0);

    if (total === 0) return { data: [], total: 0 };

    const rawIds = await baseQuery
        .orderBy(desc(contract.createdAt))
        .limit(limit)
        .offset(offset);
    
    const ids = rawIds.map(r => r.id);

    const rawResults = await db.select().from(contract)
        .where(inArray(contract.id, ids))
        .orderBy(desc(contract.createdAt));

    const data = rawResults.map((row) => ({
        ...row,
        startDate: row.startDate.toISOString(),
        endDate: row.endDate ? row.endDate.toISOString() : undefined,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    }));

    return { data, total };
});

export const readContract = query(v.object({ id: v.string() }), async ({ id }) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contracts');

    const result = await db.query.contract.findFirst({
        where: (table, { eq }) => eq(table.id, id),
        with: {
            frameworks: true
        }
    });

    if (!result) throw new Error('Not found');
    
    return {
        ...result,
        frameworkIds: result.frameworks.map(f => f.frameworkId),
        startDate: result.startDate.toISOString(),
        endDate: result.endDate ? result.endDate.toISOString() : undefined,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
    };
});

export const createContract = form(contractSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contracts');

    const insertData = { ...data };
    const frameworkIds = insertData.frameworkIds || [];
    delete (insertData as any).frameworkIds; // remove from db insert payload

    const [newContract] = await db.insert(contract).values({
        ...insertData,
        startDate: new Date(insertData.startDate),
        endDate: insertData.endDate ? new Date(insertData.endDate) : null,
    } as any).returning();

    // Create single-flight junction entries
    if (frameworkIds.length > 0) {
        const mappings = frameworkIds.map((f: string) => ({ contractId: newContract.id, frameworkId: f }));
        await db.insert(contractFrameworkContract).values(mappings);
    }

    await listContracts().refresh();
    return { success: true, id: newContract.id, contract: newContract };
});

export const updateContract = form(v.intersect([v.object({ id: v.string() }), contractSchema]), async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contracts');

    const updateData = { ...(data as any) };
    const frameworkIds = updateData.frameworkIds || [];
    delete (updateData as any).frameworkIds;
    delete (updateData as any).id;

    const [updatedContract] = await db.update(contract)
        .set({
            ...updateData,
            startDate: new Date(updateData.startDate),
            endDate: updateData.endDate ? new Date(updateData.endDate) : null,
        } as any)
        .where(eq(contract.id, data.id))
        .returning();

    // Sync junction entries
    await db.delete(contractFrameworkContract).where(eq(contractFrameworkContract.contractId, data.id));
    if (frameworkIds.length > 0) {
        const mappings = frameworkIds.map((f: string) => ({ contractId: data.id, frameworkId: f }));
        await db.insert(contractFrameworkContract).values(mappings);
    }

    await listContracts().refresh();
    await readContract({ id: data.id }).set({
        ...updatedContract,
        frameworkIds,
        startDate: updatedContract.startDate.toISOString(),
        endDate: updatedContract.endDate ? updatedContract.endDate.toISOString() : undefined,
        createdAt: updatedContract.createdAt.toISOString(),
        updatedAt: updatedContract.updatedAt.toISOString(),
        frameworks: frameworkIds.map((f: string) => ({ contractId: data.id, frameworkId: f }))
    } as any);

    return { success: true, contract: updatedContract };
});

export const deleteContract = command(v.array(v.string()), async (ids: string[]) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contracts');

    await db.delete(contract).where(inArray(contract.id, ids));
    await listContracts().refresh();

    return { success: true };
});
