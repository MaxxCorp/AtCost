import { query } from '$app/server';
import { db, desc, asc, and, or, not, ilike, sql, eq, inArray, notInArray, exists } from '@ac/db';
import { contract, contractFrameworkContract } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { parseFilterValue } from '@ac/validations/pagination';
import { contractPaginationSchema, resolveEffectiveContract } from '@ac/validations/contracts';
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
