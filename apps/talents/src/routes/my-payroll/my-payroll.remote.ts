import { query } from '$app/server';
import { db, payslip, payrollRun, userTalent, talent, contact, eq, desc } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import * as v from 'valibot';

export const listMyPayslips = query(v.optional(v.object({}), {}), async () => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'my-payroll');

    // Find talent linked to this user
    const ut = await db.query.userTalent.findFirst({
        where: eq(userTalent.userId, user.id),
    });

    if (!ut) {
        return { data: [], total: 0 };
    }

    const rows = await db
        .select({
            payslip: payslip,
            payrollRun: payrollRun,
        })
        .from(payslip)
        .innerJoin(payrollRun, eq(payslip.payrollRunId, payrollRun.id))
        .where(eq(payslip.talentId, ut.talentId))
        .orderBy(desc(payrollRun.period));

    const data = rows.map((r) => ({
        ...r.payslip,
        payrollRun: {
            ...r.payrollRun,
            startDate: r.payrollRun.startDate.toISOString(),
            endDate: r.payrollRun.endDate.toISOString(),
            createdAt: r.payrollRun.createdAt.toISOString(),
            updatedAt: r.payrollRun.updatedAt.toISOString(),
        },
        createdAt: r.payslip.createdAt.toISOString(),
        updatedAt: r.payslip.updatedAt.toISOString(),
    }));

    return { data, total: data.length };
});

export const readMyPayslip = query(v.object({ id: v.string() }), async ({ id }) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'my-payroll');

    const ut = await db.query.userTalent.findFirst({
        where: eq(userTalent.userId, user.id),
    });

    if (!ut) return null;

    const row = await db
        .select({
            payslip: payslip,
            payrollRun: payrollRun,
            talent: talent,
            contact: contact,
        })
        .from(payslip)
        .innerJoin(payrollRun, eq(payslip.payrollRunId, payrollRun.id))
        .innerJoin(talent, eq(payslip.talentId, talent.id))
        .innerJoin(contact, eq(talent.contactId, contact.id))
        .where(eq(payslip.id, id))
        .limit(1);

    if (row.length === 0) return null;

    const r = row[0];
    // Ensure payslip belongs to current talent
    if (r.payslip.talentId !== ut.talentId) {
        throw new Error('Forbidden');
    }

    return {
        ...r.payslip,
        payrollRun: {
            ...r.payrollRun,
            startDate: r.payrollRun.startDate.toISOString(),
            endDate: r.payrollRun.endDate.toISOString(),
            createdAt: r.payrollRun.createdAt.toISOString(),
            updatedAt: r.payrollRun.updatedAt.toISOString(),
        },
        talent: {
            ...r.talent,
            createdAt: r.talent.createdAt.toISOString(),
            updatedAt: r.talent.updatedAt.toISOString(),
            contact: {
                ...r.contact,
                createdAt: r.contact.createdAt.toISOString(),
                updatedAt: r.contact.updatedAt.toISOString(),
            },
        },
        createdAt: r.payslip.createdAt.toISOString(),
        updatedAt: r.payslip.updatedAt.toISOString(),
    };
});
