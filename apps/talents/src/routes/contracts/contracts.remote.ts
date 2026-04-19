import { query, form, command } from '$app/server';
import { db, desc, and, or, ilike, sql, eq, inArray } from '$lib/server/db';
import { contract, contractFrameworkContract } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { PaginationSchema, type PaginatedResult } from '@ac/validations/pagination';
import { contractPaginationSchema, contractSchema } from '@ac/validations/contracts';
import * as v from 'valibot';

export const listContracts = query(contractPaginationSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contracts');

    const { page = 1, limit = 50, search = '', talentId } = input || {};
    const offset = (page - 1) * limit;

    let baseQuery = db.select().from(contract).$dynamic();
    
    if (talentId) {
        baseQuery = baseQuery.where(eq(contract.talentId, talentId)) as any;
    }
    
    // Example: allow searching by entgeltgruppe or wageType
    if (search) {
        baseQuery = baseQuery.where(
            or(ilike(contract.entgeltgruppe, `%${search}%`), ilike(contract.wageType, `%${search}%`))
        ) as any;
    }

    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult[0]?.count || 0);

    const rawResults = await baseQuery
        .orderBy(desc(contract.createdAt))
        .limit(limit)
        .offset(offset);

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
