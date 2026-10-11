import { query, form, command } from '$app/server';
import { db, desc, asc, and, or, not, ilike, sql, eq, inArray, notInArray, exists } from '@ac/db';
import { contract, contractFrameworkContract } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { PaginationSchema, parseFilterValue, type PaginatedResult } from '@ac/validations/pagination';
import { contractPaginationSchema, contractSchema, updateContractSchema, resolveEffectiveContract } from '@ac/validations/contracts';
import * as v from 'valibot';

export const listContracts = query(contractPaginationSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contracts');

    const { page = 1, limit = 50, search = '', talentId, frameworkId, contractType, isActive } = input || {};
    const offset = (page - 1) * limit;

    let baseQuery = db.select({ id: contract.id }).from(contract).$dynamic();
    
    const conditions = [];
    if (talentId) {
        const { include, exclude } = parseFilterValue(talentId);
        if (include.length > 0) {
            conditions.push(inArray(contract.talentId, include));
        }
        if (exclude.length > 0) {
            conditions.push(notInArray(contract.talentId, exclude));
        }
    }
    
    if (frameworkId) {
        const { include, exclude } = parseFilterValue(frameworkId);
        if (include.length > 0) {
            conditions.push(
                exists(
                    db.select({ id: sql`1` })
                      .from(contractFrameworkContract)
                      .where(and(eq(contractFrameworkContract.contractId, contract.id), inArray(contractFrameworkContract.frameworkId, include)))
                )
            );
        }
        if (exclude.length > 0) {
            conditions.push(
                not(exists(
                    db.select({ id: sql`1` })
                      .from(contractFrameworkContract)
                      .where(and(eq(contractFrameworkContract.contractId, contract.id), inArray(contractFrameworkContract.frameworkId, exclude)))
                ))
            );
        }
    }

    if (contractType) {
        conditions.push(eq(contract.contractType, contractType as any));
    }

    if (typeof isActive === 'boolean') {
        conditions.push(eq(contract.isActive, isActive));
    }

    if (search) {
        conditions.push(or(
            ilike(contract.title, `%${search}%`),
            ilike(contract.entgeltgruppe, `%${search}%`),
            ilike(contract.wageType, `%${search}%`),
            ilike(contract.wageTable, `%${search}%`)
        ));
    }

    if (conditions.length > 0) {
        baseQuery = baseQuery.where(and(...conditions as any)) as any;
    }

    // Deduplicate
    baseQuery = baseQuery.groupBy(contract.id) as any;

    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult[0]?.count || 0);

    if (total === 0) return { data: [], total: 0 };

    const rawIds = await baseQuery
        .orderBy(desc(contract.precedence), desc(contract.startDate))
        .limit(limit)
        .offset(offset);
    
    const ids = rawIds.map(r => r.id);

    const rawResults = await db.select().from(contract)
        .where(inArray(contract.id, ids))
        .orderBy(desc(contract.precedence), desc(contract.startDate));

    const data = rawResults.map((row) => ({
        ...row,
        startDate: row.startDate.toISOString(),
        endDate: row.endDate ? row.endDate.toISOString() : undefined,
        nextStufenaufstiegDate: row.nextStufenaufstiegDate ? row.nextStufenaufstiegDate.toISOString() : undefined,
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
        nextStufenaufstiegDate: result.nextStufenaufstiegDate ? result.nextStufenaufstiegDate.toISOString() : undefined,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
    };
});

export const readTalentEffectiveContract = query(v.object({ talentId: v.string() }), async ({ talentId }) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contracts');

    const rawContracts = await db.select().from(contract)
        .where(eq(contract.talentId, talentId))
        .orderBy(asc(contract.precedence), asc(contract.startDate));

    const serialized = rawContracts.map((row) => ({
        ...row,
        startDate: row.startDate.toISOString(),
        endDate: row.endDate ? row.endDate.toISOString() : undefined,
        nextStufenaufstiegDate: row.nextStufenaufstiegDate ? row.nextStufenaufstiegDate.toISOString() : undefined,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    }));

    const resolution = resolveEffectiveContract(serialized);
    return {
        contracts: serialized,
        resolution,
    };
});

export const createContract = form(contractSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contracts');

    const insertData: any = { ...data };
    const frameworkIds: string[] = Array.isArray(insertData.frameworkIds) ? insertData.frameworkIds : [];
    delete insertData.frameworkIds;

    const [newContract] = await db.insert(contract).values({
        ...insertData,
        parentContractId: insertData.parentContractId || null,
        startDate: new Date(insertData.startDate),
        endDate: insertData.endDate ? new Date(insertData.endDate) : null,
        nextStufenaufstiegDate: insertData.nextStufenaufstiegDate ? new Date(insertData.nextStufenaufstiegDate) : null,
    } as any).returning();

    // Create single-flight junction entries
    if (frameworkIds.length > 0) {
        const mappings = frameworkIds.map((f: string) => ({ contractId: newContract.id, frameworkId: f }));
        await db.insert(contractFrameworkContract).values(mappings);
    }

    await listContracts().refresh();
    await readTalentEffectiveContract({ talentId: newContract.talentId }).refresh();
    return { success: true, id: newContract.id, contract: newContract };
});

export const updateContract = form(updateContractSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contracts');

    const updateData: any = { ...data };
    const contractId: string = updateData.id;
    const frameworkIds: string[] = Array.isArray(updateData.frameworkIds) ? updateData.frameworkIds : [];
    delete updateData.frameworkIds;
    delete updateData.id;

    const [updatedContract] = await db.update(contract)
        .set({
            ...updateData,
            parentContractId: updateData.parentContractId || null,
            startDate: new Date(updateData.startDate),
            endDate: updateData.endDate ? new Date(updateData.endDate) : null,
            nextStufenaufstiegDate: updateData.nextStufenaufstiegDate ? new Date(updateData.nextStufenaufstiegDate) : null,
        } as any)
        .where(eq(contract.id, contractId))
        .returning();

    // Sync junction entries
    await db.delete(contractFrameworkContract).where(eq(contractFrameworkContract.contractId, contractId));
    if (frameworkIds.length > 0) {
        const mappings = frameworkIds.map((f: string) => ({ contractId, frameworkId: f }));
        await db.insert(contractFrameworkContract).values(mappings);
    }

    await listContracts().refresh();
    await readTalentEffectiveContract({ talentId: updatedContract.talentId }).refresh();
    await readContract({ id: contractId }).set({
        ...updatedContract,
        frameworkIds,
        startDate: updatedContract.startDate.toISOString(),
        endDate: updatedContract.endDate ? updatedContract.endDate.toISOString() : undefined,
        nextStufenaufstiegDate: updatedContract.nextStufenaufstiegDate ? updatedContract.nextStufenaufstiegDate.toISOString() : undefined,
        createdAt: updatedContract.createdAt.toISOString(),
        updatedAt: updatedContract.updatedAt.toISOString(),
        frameworks: frameworkIds.map((f: string) => ({ contractId, frameworkId: f }))
    } as any);

    return { success: true, contract: updatedContract };
});

export const deleteContract = command(v.array(v.string()), async (ids: string[]) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contracts');

    const contractsToDelete = await db.select({ talentId: contract.talentId }).from(contract).where(inArray(contract.id, ids));
    const talentIds = Array.from(new Set(contractsToDelete.map(c => c.talentId)));

    await db.delete(contract).where(inArray(contract.id, ids));
    await listContracts().refresh();
    for (const tId of talentIds) {
        await readTalentEffectiveContract({ talentId: tId }).refresh();
    }

    return { success: true };
});

