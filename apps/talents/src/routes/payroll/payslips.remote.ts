import { query, command } from '$app/server';
import { db, payslip, talent, contact, contract, payrollProfile, eq, and, sql, desc, asc, inArray, notInArray } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { parseFilterValue } from '@ac/validations/pagination';
import { payslipPaginationSchema } from '@ac/validations';
import * as v from 'valibot';

export const listRunPayslips = query(payslipPaginationSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'payroll');

    const { page = 1, limit = 50, payrollRunId, talentId, status } = input || {};
    const offset = (page - 1) * limit;

    const conditions = [];

    if (payrollRunId) {
        const { include, exclude } = parseFilterValue(payrollRunId);
        if (include.length > 0) {
            conditions.push(inArray(payslip.payrollRunId, include));
        }
        if (exclude.length > 0) {
            conditions.push(notInArray(payslip.payrollRunId, exclude));
        }
    }

    if (talentId) {
        const { include, exclude } = parseFilterValue(talentId);
        if (include.length > 0) {
            conditions.push(inArray(payslip.talentId, include));
        }
        if (exclude.length > 0) {
            conditions.push(notInArray(payslip.talentId, exclude));
        }
    }

    if (status) {
        conditions.push(eq(payslip.status, status as any));
    }

    let whereClause = conditions.length > 0 ? and(...conditions as any) : undefined;

    const rawRows = await db
        .select({
            payslip: payslip,
            talent: talent,
            contact: contact,
            contract: contract,
            payrollProfile: payrollProfile,
        })
        .from(payslip)
        .innerJoin(talent, eq(payslip.talentId, talent.id))
        .innerJoin(contact, eq(talent.contactId, contact.id))
        .leftJoin(contract, eq(payslip.contractId, contract.id))
        .leftJoin(payrollProfile, eq(payslip.talentId, payrollProfile.talentId))
        .where(whereClause as any)
        .orderBy(asc(contact.familyName), asc(contact.givenName))
        .limit(limit)
        .offset(offset);

    const countResult = await db
        .select({ count: sql`count(*)` })
        .from(payslip)
        .where(whereClause as any);
    const total = Number(countResult[0]?.count || 0);

    const data = rawRows.map((r) => ({
        ...r.payslip,
        createdAt: r.payslip.createdAt.toISOString(),
        updatedAt: r.payslip.updatedAt.toISOString(),
        talent: {
            ...r.talent,
            createdAt: r.talent.createdAt.toISOString(),
            updatedAt: r.talent.updatedAt.toISOString(),
            payrollProfile: r.payrollProfile ? {
                ...r.payrollProfile,
                createdAt: r.payrollProfile.createdAt.toISOString(),
                updatedAt: r.payrollProfile.updatedAt.toISOString(),
            } : null,
            contact: {
                ...r.contact,
                createdAt: r.contact.createdAt.toISOString(),
                updatedAt: r.contact.updatedAt.toISOString(),
            },
        },
        contract: r.contract ? {
            ...r.contract,
            startDate: r.contract.startDate.toISOString(),
            endDate: r.contract.endDate ? r.contract.endDate.toISOString() : undefined,
            createdAt: r.contract.createdAt.toISOString(),
            updatedAt: r.contract.updatedAt.toISOString(),
        } : null,
    }));

    return { data, total };
});

export const readPayslip = query(v.object({ id: v.string() }), async ({ id }) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'payroll');

    const row = await db
        .select({
            payslip: payslip,
            talent: talent,
            contact: contact,
            contract: contract,
            payrollProfile: payrollProfile,
        })
        .from(payslip)
        .innerJoin(talent, eq(payslip.talentId, talent.id))
        .innerJoin(contact, eq(talent.contactId, contact.id))
        .leftJoin(contract, eq(payslip.contractId, contract.id))
        .leftJoin(payrollProfile, eq(payslip.talentId, payrollProfile.talentId))
        .where(eq(payslip.id, id))
        .limit(1);

    if (row.length === 0) return null;

    const r = row[0];
    return {
        ...r.payslip,
        createdAt: r.payslip.createdAt.toISOString(),
        updatedAt: r.payslip.updatedAt.toISOString(),
        talent: {
            ...r.talent,
            createdAt: r.talent.createdAt.toISOString(),
            updatedAt: r.talent.updatedAt.toISOString(),
            payrollProfile: r.payrollProfile ? {
                ...r.payrollProfile,
                createdAt: r.payrollProfile.createdAt.toISOString(),
                updatedAt: r.payrollProfile.updatedAt.toISOString(),
            } : null,
            contact: {
                ...r.contact,
                createdAt: r.contact.createdAt.toISOString(),
                updatedAt: r.contact.updatedAt.toISOString(),
            },
        },
        contract: r.contract ? {
            ...r.contract,
            startDate: r.contract.startDate.toISOString(),
            endDate: r.contract.endDate ? r.contract.endDate.toISOString() : undefined,
            createdAt: r.contract.createdAt.toISOString(),
            updatedAt: r.contract.updatedAt.toISOString(),
        } : null,
    };
});
