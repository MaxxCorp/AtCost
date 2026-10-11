import {
    db,
    payrollRun,
    payrollProfile,
    payslip,
    hmo,
    talent,
    contract,
    timesheetEntry,
    timeOffRequest,
    contact,
    userTalent,
    tag,
    talentTag,
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
import {
    getEffectiveSocialInsuranceCondition,
    getEffectiveUnionContractCondition
} from "#lib/server/conditions/service.js";


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
    let startDate: Date;
    let endDate: Date;

    if (input.startDate && input.endDate) {
        startDate = new Date(input.startDate);
        endDate = new Date(input.endDate);
    } else {
        const range = getMonthDateRange(input.period);
        startDate = range.startDate;
        endDate = range.endDate;
    }

    const [created] = await db.insert(payrollRun).values({
        name: input.name,
        period: input.period,
        startDate,
        endDate,
        jurisdiction: input.jurisdiction || 'DE',
        targetGroup: input.targetGroup || 'all',
        tagIds: input.tagIds || [],
        cycleType: input.cycleType || 'monthly',
        paymentDueDate: input.paymentDueDate ? new Date(input.paymentDueDate) : null,
        status: 'draft',
        notes: input.notes,
    }).returning();

    return created;
}

export async function getPayrollRun(id: string) {
    const run = await db.query.payrollRun.findFirst({
        where: eq(payrollRun.id, id),
    });
    if (!run) return null;

    let targetTags: any[] = [];
    if (run.tagIds && Array.isArray(run.tagIds) && run.tagIds.length > 0) {
        targetTags = await db.query.tag.findMany({
            where: inArray(tag.id, run.tagIds),
            with: {
                category: true,
            }
        });
    }

    return {
        ...run,
        targetTags,
    };
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

    // Retrieve approved conditions effective for this specific run period (guarantees retroactive consistency)
    const effectiveSocialCondition = await getEffectiveSocialInsuranceCondition(run.endDate, run.jurisdiction);

    // Fetch all talents with contact details and tags
    const allTalents = await db.query.talent.findMany({
        with: {
            contact: true,
            contracts: {
                orderBy: [asc(contract.precedence), asc(contract.startDate)],
            },
            payrollProfile: {
                with: {
                    hmo: true,
                    accidentHmo: true,
                    pensionHmo: true,
                }
            },
            tags: {
                with: {
                    tag: true,
                }
            }
        },
    });

    // Filter talents according to run targetGroup and tagIds
    let eligibleTalents = allTalents;

    if (run.tagIds && Array.isArray(run.tagIds) && run.tagIds.length > 0) {
        const tagSet = new Set(run.tagIds);
        eligibleTalents = eligibleTalents.filter(t => {
            const talentTagIds = (t.tags || []).map(tt => tt.tagId);
            return talentTagIds.some(id => tagSet.has(id));
        });
    }

    if (run.targetGroup === 'salaried') {
        eligibleTalents = eligibleTalents.filter(t => {
            const effRes = resolveEffectiveContract(t.contracts as any, run.endDate);
            const eff = effRes?.effective;
            return !eff || eff.wageType !== 'hourly';
        });
    } else if (run.targetGroup === 'hourly') {
        eligibleTalents = eligibleTalents.filter(t => {
            const effRes = resolveEffectiveContract(t.contracts as any, run.endDate);
            const eff = effRes?.effective;
            return eff && eff.wageType === 'hourly';
        });
    }

    let totalGross = 0;
    let totalNet = 0;
    let totalEmployerCost = 0;
    let totalJobcenterSubsidy = 0;
    let totalNetEmployerCost = 0;
    let totalEmployees = 0;

    // Delete existing calculated payslips for this run to regenerate cleanly
    await db.delete(payslip).where(eq(payslip.payrollRunId, runId));

    for (const t of eligibleTalents) {
        // Resolve active contract at run end date
        const effectiveContractRes = resolveEffectiveContract(t.contracts as any, run.endDate);
        const effectiveContract = effectiveContractRes?.effective || null;

        // If contract references a collective agreement wageTable, resolve approved tariff condition for this run period
        if (effectiveContract?.wageTable && (!effectiveContract.wageAmount || effectiveContract.wageAmount === 0)) {
            const effectiveUnionCondition = await getEffectiveUnionContractCondition(effectiveContract.wageTable, run.endDate);
            if (effectiveUnionCondition?.wageGrid && effectiveContract.entgeltgruppe) {
                const eg = effectiveContract.entgeltgruppe;
                const stufe = String(effectiveContract.erfahrungsstufe || 1);
                const gridVal = (effectiveUnionCondition.wageGrid as any)?.[eg]?.[stufe];
                if (typeof gridVal === 'number' && gridVal > 0) {
                    effectiveContract.wageAmount = gridVal;
                    effectiveContract.effectiveWageAmount = gridVal;
                }
            }
        }

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

        // Prepare payroll profile fallback and load HMO / insurer records directly for computation
        const rawProfile = t.payrollProfile as any;
        let hmoRecord = rawProfile?.hmo || null;
        let accidentHmoRecord = rawProfile?.accidentHmo || null;
        let pensionHmoRecord = rawProfile?.pensionHmo || null;

        if (!hmoRecord && rawProfile?.hmoId) {
            hmoRecord = await db.query.hmo.findFirst({
                where: eq(hmo.id, rawProfile.hmoId),
            }) || null;
        }

        if (!accidentHmoRecord && rawProfile?.accidentHmoId) {
            accidentHmoRecord = await db.query.hmo.findFirst({
                where: eq(hmo.id, rawProfile.accidentHmoId),
            }) || null;
        }
        if (!accidentHmoRecord) {
            accidentHmoRecord = await db.query.hmo.findFirst({
                where: and(eq(hmo.category, 'accident'), eq(hmo.isActive, true)),
            }) || null;
        }

        if (!pensionHmoRecord && rawProfile?.pensionHmoId) {
            pensionHmoRecord = await db.query.hmo.findFirst({
                where: eq(hmo.id, rawProfile.pensionHmoId),
            }) || null;
        }

        const profile = rawProfile ? {
            ...rawProfile,
            hmo: hmoRecord,
            accidentHmo: accidentHmoRecord,
            pensionHmo: pensionHmoRecord,
            healthInsuranceName: hmoRecord?.name ?? rawProfile.healthInsuranceName ?? 'Techniker Krankenkasse (TK)',
            healthInsuranceAdditionalContributionPercent: hmoRecord ? hmoRecord.additionalContributionPercent : Number(rawProfile.healthInsuranceAdditionalContributionPercent ?? 2.5),
            healthInsuranceType: hmoRecord?.type ?? rawProfile.healthInsuranceType ?? 'statutory',
        } : {
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
            fundingProgram: 'none',
            fundingSubsidyPercentage: 100,
            fundingYear: 1,
            furtherTrainingBudget: 3000,
            furtherTrainingUsed: 0,
            coachingHoursPerMonth: 2,
            deuevPersonengruppe: '101',
            deuevBeitragsgruppe: '1111',
            hmo: null,
            accidentHmo: accidentHmoRecord,
            pensionHmo: null,
        };

        const calcInput: PayrollCalculationInput = {
            talentId: t.id,
            talentName: t.contact?.displayName || `${t.contact?.givenName ?? ''} ${t.contact?.familyName ?? ''}`.trim() || 'Employee',
            period: run.period,
            startDate: run.startDate,
            endDate: run.endDate,
            contract: effectiveContract,
            payrollProfile: profile,
            socialInsuranceConditions: effectiveSocialCondition as any,
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

                fundingProgram: result.fundingProgram,
                jobcenterSubsidy: result.jobcenterSubsidy,
                netEmployerCost: result.netEmployerCost,
                deuevPersonengruppe: result.deuevPersonengruppe,
                deuevBeitragsgruppe: result.deuevBeitragsgruppe,

                lineItems: result.lineItems,
                calculationDetails: result.calculationDetails,
            });

            totalGross += result.grossSalary;
            totalNet += result.netSalary;
            totalEmployerCost += result.totalEmployerCost;
            totalJobcenterSubsidy += result.jobcenterSubsidy;
            totalNetEmployerCost += result.netEmployerCost;
            totalEmployees += 1;
        }
    }

    // Update payroll run with aggregated totals
    const [updatedRun] = await db.update(payrollRun).set({
        status: 'calculated',
        totalGross: Math.round(totalGross * 100) / 100,
        totalNet: Math.round(totalNet * 100) / 100,
        totalEmployerCost: Math.round(totalEmployerCost * 100) / 100,
        totalJobcenterSubsidy: Math.round(totalJobcenterSubsidy * 100) / 100,
        totalNetEmployerCost: Math.round(totalNetEmployerCost * 100) / 100,
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
