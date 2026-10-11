import { query, form, command, requested } from '$app/server';
import { db, payrollRun, payslip, desc, asc, eq, ilike, or, and, sql } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import {
    payrollRunPaginationSchema,
    createPayrollRunSchema,
    updatePayrollRunSchema,
} from '@ac/validations';
import * as v from 'valibot';
import {
    createPayrollRun,
    calculatePayrollRun,
    approvePayrollRun,
    finalizePayrollRun,
} from '#lib/server/payroll/service.js';

export const listPayrollRuns = query(payrollRunPaginationSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'payroll');

    const { page = 1, limit = 50, search = '', status, period, jurisdiction } = input || {};
    const offset = (page - 1) * limit;

    let baseQuery = db.select().from(payrollRun).$dynamic();
    const conditions = [];

    if (status) {
        conditions.push(eq(payrollRun.status, status as any));
    }
    if (period) {
        conditions.push(eq(payrollRun.period, period));
    }
    if (jurisdiction) {
        conditions.push(eq(payrollRun.jurisdiction, jurisdiction));
    }
    if (search) {
        conditions.push(
            or(
                ilike(payrollRun.name, `%${search}%`),
                ilike(payrollRun.period, `%${search}%`),
                ilike(payrollRun.notes, `%${search}%`)
            )
        );
    }

    if (conditions.length > 0) {
        baseQuery = baseQuery.where(and(...conditions as any)) as any;
    }

    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult[0]?.count || 0);

    if (total === 0) return { data: [], total: 0 };

    const rawResults = await baseQuery
        .orderBy(desc(payrollRun.period), desc(payrollRun.createdAt))
        .limit(limit)
        .offset(offset);

    const data = rawResults.map((r) => ({
        ...r,
        startDate: r.startDate.toISOString(),
        endDate: r.endDate.toISOString(),
        calculatedAt: r.calculatedAt ? r.calculatedAt.toISOString() : undefined,
        finalizedAt: r.finalizedAt ? r.finalizedAt.toISOString() : undefined,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
    }));

    return { data, total };
});

export const readPayrollRun = query(v.object({ id: v.string() }), async ({ id }) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'payroll');

    const run = await db.query.payrollRun.findFirst({
        where: eq(payrollRun.id, id),
    });

    if (!run) return null;

    return {
        ...run,
        startDate: run.startDate.toISOString(),
        endDate: run.endDate.toISOString(),
        calculatedAt: run.calculatedAt ? run.calculatedAt.toISOString() : undefined,
        finalizedAt: run.finalizedAt ? run.finalizedAt.toISOString() : undefined,
        createdAt: run.createdAt.toISOString(),
        updatedAt: run.updatedAt.toISOString(),
    };
});

export const createPayrollRunAction = form(createPayrollRunSchema, async (input) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'payroll');

    const created = await createPayrollRun(input);

    try {
        await requested(listPayrollRuns, 20).refreshAll();
    } catch { /* ignore */ }
    void listPayrollRuns().refresh();
    void listPayrollRuns({}).refresh();

    return {
        success: true,
        id: created.id,
    };
});

export const calculatePayrollRunAction = command(v.object({ runId: v.string() }), async ({ runId }) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'payroll');

    const updated = await calculatePayrollRun(runId);

    try {
        await requested(listPayrollRuns, 20).refreshAll();
    } catch { /* ignore */ }
    void listPayrollRuns().refresh();
    void listPayrollRuns({}).refresh();
    void readPayrollRun({ id: runId }).refresh();

    return {
        success: true,
        run: updated,
    };
});

export const approvePayrollRunAction = command(v.object({ runId: v.string() }), async ({ runId }) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'payroll');

    const updated = await approvePayrollRun(runId);

    try {
        await requested(listPayrollRuns, 20).refreshAll();
    } catch { /* ignore */ }
    void listPayrollRuns().refresh();
    void listPayrollRuns({}).refresh();
    void readPayrollRun({ id: runId }).refresh();

    return {
        success: true,
        run: updated,
    };
});

export const finalizePayrollRunAction = command(v.object({ runId: v.string() }), async ({ runId }) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'payroll');

    const updated = await finalizePayrollRun(runId);

    try {
        await requested(listPayrollRuns, 20).refreshAll();
    } catch { /* ignore */ }
    void listPayrollRuns().refresh();
    void listPayrollRuns({}).refresh();
    void readPayrollRun({ id: runId }).refresh();

    return {
        success: true,
        run: updated,
    };
});

export const deletePayrollRunAction = command(v.object({ runId: v.string() }), async ({ runId }) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'payroll');

    await db.delete(payrollRun).where(eq(payrollRun.id, runId));

    try {
        await requested(listPayrollRuns, 20).refreshAll();
    } catch { /* ignore */ }
    void listPayrollRuns().refresh();
    void listPayrollRuns({}).refresh();

    return { success: true };
});
