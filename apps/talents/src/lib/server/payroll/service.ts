import {
    db,
    payrollRun,
    payrollProfile,
    payslip,
    talent,
    contract,
    timesheetEntry,
    timeOffRequest,
    contact,
    userTalent,
    eq,
    and,
    gte,
    lte,
    desc,
    asc,
    inArray,
    sql,
    ilike,
    or
} from "@ac/db";
import {
    getPayrollEngine,
    resolveEffectiveContract,
    type CreatePayrollRunInput,
    type PayrollProfileInput,
    type PayrollCalculationInput
} from "@ac/validations";

export function getMonthDateRange(period: string): { startDate: Date; endDate: Date } {
    const [yearStr, monthStr] = period.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-12

    // Start: first day of month 00:00:00 UTC
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));

    // End: last day of month 23:59:59.999 UTC
    const nextMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const endDate = new Date(nextMonth.getTime() - 1);

    return { startDate, endDate };
}

export async function createPayrollRun(input: CreatePayrollRunInput) {
    const { startDate, endDate } = getMonthDateRange(input.period);

    const [created] = await db.insert(payrollRun).values({
        name: input.name,
        period: input.period,
        startDate,
        endDate,
        jurisdiction: input.jurisdiction || 'DE',
        status: 'draft',
        notes: input.notes,
    }).returning();

    return created;
}

export async function getPayrollRun(id: string) {
    const run = await db.query.payrollRun.findFirst({
        where: eq(payrollRun.id, id),
    });
    return run;
}

export async function calculatePayrollRun(runId: string) {
    const run = await getPayrollRun(runId);
    if (!run) {
        throw new Error('Payroll run not found');
    }

    if (run.status === 'finalized') {
        throw new Error('Cannot recalculate a finalized payroll run');
    }

    const engine = getPayrollEngine(run.jurisdiction);

    // Fetch all talents with contact details
    const allTalents = await db.query.talent.findMany({
        with: {
            contact: true,
            contracts: {
                orderBy: [asc(contract.precedence), asc(contract.startDate)],
            },
            payrollProfile: true,
        },
    });

    let totalGross = 0;
    let totalNet = 0;
    let totalEmployerCost = 0;
    let totalEmployees = 0;

    // Delete existing calculated payslips for this run to regenerate cleanly
    await db.delete(payslip).where(eq(payslip.payrollRunId, runId));

    for (const t of allTalents) {
        // Resolve active contract at run end date
        const effectiveContractRes = resolveEffectiveContract(t.contracts as any, run.endDate);
        const effectiveContract = effectiveContractRes?.effective || null;

        // Fetch approved timesheet entries for this talent in this period
        const timesheets = await db.select().from(timesheetEntry).where(
            and(
                eq(timesheetEntry.talentId, t.id),
                eq(timesheetEntry.status, 'approved'),
                gte(timesheetEntry.startTime, run.startDate),
                lte(timesheetEntry.startTime, run.endDate)
            )
        );

        // Fetch approved time-off requests
        const leaves = await db.select().from(timeOffRequest).where(
            and(
                eq(timeOffRequest.talentId, t.id),
                eq(timeOffRequest.status, 'approved'),
                or(
                    and(gte(timeOffRequest.startDate, run.startDate), lte(timeOffRequest.startDate, run.endDate)),
                    and(gte(timeOffRequest.endDate, run.startDate), lte(timeOffRequest.endDate, run.endDate))
                )
            )
        );

        // Prepare payroll profile fallback if not created yet
        const profile = t.payrollProfile || {
            taxClass: '1',
            childCount: 0,
            churchTax: 'none',
            state: 'BE',
            healthInsuranceName: 'Techniker Krankenkasse (TK)',
            healthInsuranceType: 'statutory',
            healthInsuranceAdditionalContributionPercent: 2.5,
            pensionInsuranceExempt: false,
            unemploymentInsuranceExempt: false,
            hasChildren: false,
            employmentType: 'regular',
        };

        const calcInput: PayrollCalculationInput = {
            talentId: t.id,
            talentName: t.contact?.displayName || `${t.contact?.givenName ?? ''} ${t.contact?.familyName ?? ''}`.trim() || 'Employee',
            period: run.period,
            startDate: run.startDate,
            endDate: run.endDate,
            contract: effectiveContract,
            payrollProfile: profile,
            timesheetEntries: timesheets,
            timeOffRequests: leaves,
        };

        const result = engine.calculate(calcInput);

        // Only create payslip if talent has a contract or worked hours
        if (effectiveContract || result.workedHours > 0 || result.grossSalary > 0) {
            await db.insert(payslip).values({
                payrollRunId: run.id,
                talentId: t.id,
                contractId: effectiveContractRes?.highestContract?.id || null,
                jurisdiction: run.jurisdiction,
                status: 'calculated',

                contractHours: result.contractHours,
                workedHours: result.workedHours,
                overtimeHours: result.overtimeHours,
                nightHours: result.nightHours,
                sundayHours: result.sundayHours,
                holidayHours: result.holidayHours,
                paidLeaveHours: result.paidLeaveHours,

                baseSalary: result.baseSalary,
                hourlyWage: result.hourlyWage,
                overtimePay: result.overtimePay,
                overtimeSurcharges: result.overtimeSurcharges,
                nightSurchargesTaxFree: result.nightSurchargesTaxFree,
                sundaySurchargesTaxFree: result.sundaySurchargesTaxFree,
                holidaySurchargesTaxFree: result.holidaySurchargesTaxFree,
                allowances: result.allowances,
                employerVl: result.employerVl,
                bonus: result.bonus,
                otherAdditions: result.otherAdditions,
                grossSalary: result.grossSalary,
                taxableGross: result.taxableGross,
                socialSecurityGross: result.socialSecurityGross,
                pensionGross: result.pensionGross,

                wageTax: result.wageTax,
                solidaritySurcharge: result.solidaritySurcharge,
                churchTax: result.churchTax,
                totalTax: result.totalTax,

                employeeHealthInsurance: result.employeeHealthInsurance,
                employeePensionInsurance: result.employeePensionInsurance,
                employeeUnemploymentInsurance: result.employeeUnemploymentInsurance,
                employeeLongTermCareInsurance: result.employeeLongTermCareInsurance,
                totalEmployeeSocialSecurity: result.totalEmployeeSocialSecurity,

                netSalary: result.netSalary,
                netDeductions: result.netDeductions,
                payoutAmount: result.payoutAmount,

                employerHealthInsurance: result.employerHealthInsurance,
                employerPensionInsurance: result.employerPensionInsurance,
                employerUnemploymentInsurance: result.employerUnemploymentInsurance,
                employerLongTermCareInsurance: result.employerLongTermCareInsurance,
                employerLevies: result.employerLevies,
                totalEmployerSocialSecurity: result.totalEmployerSocialSecurity,
                totalEmployerCost: result.totalEmployerCost,

                lineItems: result.lineItems,
                calculationDetails: result.calculationDetails,
            });

            totalGross += result.grossSalary;
            totalNet += result.netSalary;
            totalEmployerCost += result.totalEmployerCost;
            totalEmployees += 1;
        }
    }

    // Update payroll run with aggregated totals
    const [updatedRun] = await db.update(payrollRun).set({
        status: 'calculated',
        totalGross: Math.round(totalGross * 100) / 100,
        totalNet: Math.round(totalNet * 100) / 100,
        totalEmployerCost: Math.round(totalEmployerCost * 100) / 100,
        totalEmployees,
        calculatedAt: new Date(),
        updatedAt: new Date(),
    }).where(eq(payrollRun.id, runId)).returning();

    return updatedRun;
}

export async function approvePayrollRun(runId: string) {
    const [updated] = await db.update(payrollRun).set({
        status: 'approved',
        updatedAt: new Date(),
    }).where(eq(payrollRun.id, runId)).returning();
    return updated;
}

export async function finalizePayrollRun(runId: string) {
    const [updated] = await db.update(payrollRun).set({
        status: 'finalized',
        finalizedAt: new Date(),
        updatedAt: new Date(),
    }).where(eq(payrollRun.id, runId)).returning();

    // Mark all payslips as approved
    await db.update(payslip).set({
        status: 'approved',
        updatedAt: new Date(),
    }).where(eq(payslip.payrollRunId, runId));

    return updated;
}

export async function upsertPayrollProfile(data: PayrollProfileInput) {
    const existing = await db.query.payrollProfile.findFirst({
        where: eq(payrollProfile.talentId, data.talentId),
    });

    if (existing) {
        const [updated] = await db.update(payrollProfile).set({
            ...data,
            updatedAt: new Date(),
        }).where(eq(payrollProfile.id, existing.id)).returning();
        return updated;
    } else {
        const [created] = await db.insert(payrollProfile).values({
            ...data,
        }).returning();
        return created;
    }
}

export async function getPayrollProfileByTalentId(talentId: string) {
    return await db.query.payrollProfile.findFirst({
        where: eq(payrollProfile.talentId, talentId),
    });
}
