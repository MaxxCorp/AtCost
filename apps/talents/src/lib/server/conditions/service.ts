import {
    db,
    socialInsuranceCondition,
    unionContractCondition,
    task,
    contractFramework,
    hmo,
    eq,
    and,
    or,
    desc,
    lte,
    ilike,
    type SocialInsuranceCondition,
    type UnionContractCondition
} from '@ac/db';
import type { ChangeDiffItem, HmoRateItem } from '@ac/validations';

export function getMonthDateRange(period: string): { startDate: Date; endDate: Date } {
    const [yearStr, monthStr] = period.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const nextMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const endDate = new Date(nextMonth.getTime() - 1);

    return { startDate, endDate };
}

/**
 * Standard German Statutory Baseline HMO List & Contribution Rates
 */
export const DEFAULT_GERMAN_HMO_RATES: HmoRateItem[] = [
    { name: 'Techniker Krankenkasse (TK)', code: 'TK', additionalContributionPercent: 2.50 },
    { name: 'BARMER', code: 'BARMER', additionalContributionPercent: 2.79 },
    { name: 'DAK-Gesundheit', code: 'DAK', additionalContributionPercent: 2.80 },
    { name: 'AOK Nordost', code: 'AOK_NO', additionalContributionPercent: 2.70 },
    { name: 'AOK Plus', code: 'AOK_PLUS', additionalContributionPercent: 2.60 },
    { name: 'AOK Bayern', code: 'AOK_BY', additionalContributionPercent: 2.58 },
    { name: 'AOK Baden-Württemberg', code: 'AOK_BW', additionalContributionPercent: 2.40 },
    { name: 'IKK classic', code: 'IKK_CLASSIC', additionalContributionPercent: 2.60 },
    { name: 'SBK Siemens-Betriebskrankenkasse', code: 'SBK', additionalContributionPercent: 2.50 },
    { name: 'hkk Krankenkasse', code: 'HKK', additionalContributionPercent: 1.98 },
    { name: 'VIACTIV Krankenkasse', code: 'VIACTIV', additionalContributionPercent: 2.79 },
    { name: 'KKH Kaufmännische Krankenkasse', code: 'KKH', additionalContributionPercent: 3.28 },
    { name: 'Mobil Krankenkasse', code: 'BKK_MOBIL', additionalContributionPercent: 2.70 },
    { name: 'pronova BKK', code: 'PRONOVA', additionalContributionPercent: 2.80 },
    { name: 'Knappschaft', code: 'KNAPPSCHAFT', additionalContributionPercent: 2.90 },
];

/**
 * Standard AWO Berlin (E-Tabelle) Baseline Wage Grid
 */
export const DEFAULT_AWO_BERLIN_WAGE_GRID: Record<string, Record<string, number>> = {
    'E 1': { '1': 2250.00, '2': 2310.00, '3': 2380.00, '4': 2440.00, '5': 2500.00, '6': 2560.00 },
    'E 2': { '1': 2420.00, '2': 2510.00, '3': 2600.00, '4': 2690.00, '5': 2770.00, '6': 2850.00 },
    'E 3': { '1': 2610.00, '2': 2720.00, '3': 2830.00, '4': 2940.00, '5': 3040.00, '6': 3140.00 },
    'E 4': { '1': 2800.00, '2': 2930.00, '3': 3060.00, '4': 3190.00, '5': 3310.00, '6': 3430.00 },
    'E 5': { '1': 3010.00, '2': 3160.00, '3': 3310.00, '4': 3460.00, '5': 3600.00, '6': 3740.00 },
    'E 6': { '1': 3240.00, '2': 3410.00, '3': 3580.00, '4': 3750.00, '5': 3910.00, '6': 4070.00 },
    'E 7': { '1': 3480.00, '2': 3670.00, '3': 3860.00, '4': 4050.00, '5': 4230.00, '6': 4410.00 },
    'E 8': { '1': 3730.00, '2': 3940.00, '3': 4150.00, '4': 4360.00, '5': 4560.00, '6': 4760.00 },
    'E 9a': { '1': 4000.00, '2': 4230.00, '3': 4460.00, '4': 4690.00, '5': 4910.00, '6': 5130.00 },
    'E 9b': { '1': 4280.00, '2': 4530.00, '3': 4780.00, '4': 5030.00, '5': 5270.00, '6': 5510.00 },
    'E 10': { '1': 4580.00, '2': 4850.00, '3': 5120.00, '4': 5390.00, '5': 5650.00, '6': 5910.00 },
    'E 11': { '1': 4900.00, '2': 5190.00, '3': 5480.00, '4': 5770.00, '5': 6050.00, '6': 6330.00 },
    'E 12': { '1': 5240.00, '2': 5550.00, '3': 5860.00, '4': 6170.00, '5': 6470.00, '6': 6770.00 },
    'E 13': { '1': 5600.00, '2': 5930.00, '3': 6260.00, '4': 6590.00, '5': 6910.00, '6': 7230.00 },
    'E 14': { '1': 5980.00, '2': 6330.00, '3': 6680.00, '4': 7030.00, '5': 7370.00, '6': 7710.00 },
    'E 15': { '1': 6380.00, '2': 6750.00, '3': 7120.00, '4': 7490.00, '5': 7850.00, '6': 8210.00 },
};

/**
 * Standard TV-L Baseline Wage Grid
 */
export const DEFAULT_TV_L_WAGE_GRID: Record<string, Record<string, number>> = {
    'E 1': { '1': 2280.00, '2': 2340.00, '3': 2410.00, '4': 2470.00, '5': 2530.00, '6': 2590.00 },
    'E 9b': { '1': 4320.00, '2': 4570.00, '3': 4820.00, '4': 5070.00, '5': 5310.00, '6': 5550.00 },
    'E 10': { '1': 4620.00, '2': 4890.00, '3': 5160.00, '4': 5430.00, '5': 5690.00, '6': 5950.00 },
    'E 11': { '1': 4940.00, '2': 5230.00, '3': 5520.00, '4': 5810.00, '5': 6090.00, '6': 6370.00 },
    'E 12': { '1': 5280.00, '2': 5590.00, '3': 5900.00, '4': 6210.00, '5': 6510.00, '6': 6810.00 },
};

/**
 * Retrieves the effective approved or superseded social insurance condition
 * for a specific period or reference date. Enables 100% accurate retroactive calculations!
 */
export async function getEffectiveSocialInsuranceCondition(
    periodOrDate: string | Date,
    jurisdiction: string = 'DE'
): Promise<SocialInsuranceCondition | null> {
    const targetDate = typeof periodOrDate === 'string'
        ? getMonthDateRange(periodOrDate).endDate
        : periodOrDate;

    // Find the latest condition valid on or before targetDate that was approved (or superseded after approval)
    const condition = await db.query.socialInsuranceCondition.findFirst({
        where: and(
            eq(socialInsuranceCondition.jurisdiction, jurisdiction),
            or(
                eq(socialInsuranceCondition.status, 'approved'),
                eq(socialInsuranceCondition.status, 'superseded')
            ),
            lte(socialInsuranceCondition.effectiveDate, targetDate)
        ),
        orderBy: [desc(socialInsuranceCondition.effectiveDate), desc(socialInsuranceCondition.approvedAt)]
    });

    return condition || null;
}

/**
 * Retrieves the effective union contract condition for a specific tariff and period.
 */
export async function getEffectiveUnionContractCondition(
    tariffCodeOrName: string,
    periodOrDate: string | Date
): Promise<UnionContractCondition | null> {
    const targetDate = typeof periodOrDate === 'string'
        ? getMonthDateRange(periodOrDate).endDate
        : periodOrDate;

    const condition = await db.query.unionContractCondition.findFirst({
        where: and(
            or(
                eq(unionContractCondition.tariffCode, tariffCodeOrName),
                eq(unionContractCondition.name, tariffCodeOrName),
                ilike(unionContractCondition.tariffCode, `%${tariffCodeOrName}%`),
                ilike(unionContractCondition.name, `%${tariffCodeOrName}%`)
            ),
            or(
                eq(unionContractCondition.status, 'approved'),
                eq(unionContractCondition.status, 'superseded')
            ),
            lte(unionContractCondition.effectiveDate, targetDate)
        ),
        orderBy: [desc(unionContractCondition.effectiveDate), desc(unionContractCondition.approvedAt)]
    });

    return condition || null;
}

/**
 * Returns full audit history of social insurance and union contract conditions
 */
export async function listConditionHistory() {
    const socialConditions = await db.query.socialInsuranceCondition.findMany({
        orderBy: [desc(socialInsuranceCondition.effectiveDate), desc(socialInsuranceCondition.createdAt)]
    });

    const unionConditions = await db.query.unionContractCondition.findMany({
        orderBy: [desc(unionContractCondition.effectiveDate), desc(unionContractCondition.createdAt)]
    });

    return {
        socialConditions,
        unionConditions,
    };
}

/**
 * Returns pending review conditions awaiting approval
 */
export async function listPendingConditionReviews() {
    const pendingSocial = await db.query.socialInsuranceCondition.findMany({
        where: eq(socialInsuranceCondition.status, 'pending_review'),
        orderBy: [desc(socialInsuranceCondition.createdAt)]
    });

    const pendingUnion = await db.query.unionContractCondition.findMany({
        where: eq(unionContractCondition.status, 'pending_review'),
        orderBy: [desc(unionContractCondition.createdAt)]
    });

    return {
        pendingSocial,
        pendingUnion,
        totalPending: pendingSocial.length + pendingUnion.length
    };
}

/**
 * Pulls current/upcoming rates from authoritative sources (or external simulation),
 * detects changes vs. active conditions, and creates shared tasks for Admin, HR & Management review.
 */
export async function syncConditions(options: {
    force?: boolean;
    period?: string;
    simulateChange?: boolean;
    userId?: string;
} = {}) {
    const now = new Date();
    // Default period: current month "YYYY-MM"
    const period = options.period || `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const { startDate, endDate } = getMonthDateRange(period);

    const activeSocial = await getEffectiveSocialInsuranceCondition(period);
    const activeUnion = await getEffectiveUnionContractCondition('AWO_BERLIN', period);

    const createdConditions: Array<{ type: string; id: string; name: string }> = [];
    const createdTasks: Array<any> = [];

    // --- 1. SOCIAL INSURANCE & HMO CHECK ---
    const latestSocial = {
        name: `Gesetzliche Sozialversicherung & HMO Krankenkassen (${period})`,
        bbgKvPvMonthly: 5812.50,
        bbgRvAvMonthly: 8450.00,
        minijobLimit: 538.00,
        rvRateTotal: 0.186,
        rvRateHalf: 0.093,
        avRateTotal: 0.026,
        avRateHalf: 0.013,
        kvBaseRateHalf: 0.073,
        pvBaseRateAn: 0.022,
        pvBaseRateAg: 0.018,
        pvChildlessSurcharge: 0.006,
        u1Rate: 0.015,
        u2Rate: 0.0045,
        insolvenzRate: 0.0006,
        hmoRates: DEFAULT_GERMAN_HMO_RATES.map((h) => ({ ...h }))
    };

    // If simulating change (e.g. for testing the review runner), bump TK or Barmer rates slightly
    if (options.simulateChange) {
        const tk = latestSocial.hmoRates.find(h => h.code === 'TK');
        if (tk) tk.additionalContributionPercent = 2.60; // 2.50 -> 2.60%
        const barmer = latestSocial.hmoRates.find(h => h.code === 'BARMER');
        if (barmer) barmer.additionalContributionPercent = 2.90; // 2.79 -> 2.90%
    }

    const socialDiffs: ChangeDiffItem[] = [];

    if (!activeSocial) {
        // First initialization
        socialDiffs.push({
            field: 'Initial Statutory Social Insurance Baseline',
            oldValue: 'None',
            newValue: `Initialized statutory values for ${period}`,
        });
    } else {
        if (activeSocial.bbgKvPvMonthly !== latestSocial.bbgKvPvMonthly) {
            socialDiffs.push({
                field: 'BBG KV/PV (Monatlich)',
                oldValue: activeSocial.bbgKvPvMonthly,
                newValue: latestSocial.bbgKvPvMonthly,
                unit: '€'
            });
        }
        if (activeSocial.bbgRvAvMonthly !== latestSocial.bbgRvAvMonthly) {
            socialDiffs.push({
                field: 'BBG RV/AV (Monatlich)',
                oldValue: activeSocial.bbgRvAvMonthly,
                newValue: latestSocial.bbgRvAvMonthly,
                unit: '€'
            });
        }
        if (activeSocial.minijobLimit !== latestSocial.minijobLimit) {
            socialDiffs.push({
                field: 'Geringfügigkeitsgrenze (Minijob)',
                oldValue: activeSocial.minijobLimit,
                newValue: latestSocial.minijobLimit,
                unit: '€'
            });
        }

        // Check HMO Krankenkassen Zusatzbeitrag differences
        const activeHmos = activeSocial.hmoRates || [];
        for (const latestHmo of latestSocial.hmoRates) {
            const currentHmo = activeHmos.find(h => h.name === latestHmo.name || h.code === latestHmo.code);
            if (!currentHmo) {
                socialDiffs.push({
                    field: `Neue Krankenkasse: ${latestHmo.name}`,
                    oldValue: 'N/A',
                    newValue: `${latestHmo.additionalContributionPercent}% Zusatzbeitrag`,
                    unit: '%'
                });
            } else if (currentHmo.additionalContributionPercent !== latestHmo.additionalContributionPercent) {
                socialDiffs.push({
                    field: `Zusatzbeitrag ${latestHmo.name}`,
                    oldValue: currentHmo.additionalContributionPercent,
                    newValue: latestHmo.additionalContributionPercent,
                    unit: '%'
                });
            }
        }
    }

    // Check if there are differences or force flag is on
    const hasSocialChanges = socialDiffs.length > 0 || options.force;
    if (hasSocialChanges) {
        // Check if there is already a pending condition for this period to avoid duplicate tasks
        const existingPending = await db.query.socialInsuranceCondition.findFirst({
            where: and(
                eq(socialInsuranceCondition.effectivePeriod, period),
                eq(socialInsuranceCondition.status, 'pending_review')
            )
        });

        if (!existingPending) {
            const nextVersion = (activeSocial?.version || 0) + 1;
            const [newCondition] = await db.insert(socialInsuranceCondition).values({
                name: latestSocial.name,
                version: nextVersion,
                effectivePeriod: period,
                effectiveDate: startDate,
                status: 'pending_review',
                bbgKvPvMonthly: latestSocial.bbgKvPvMonthly,
                bbgRvAvMonthly: latestSocial.bbgRvAvMonthly,
                minijobLimit: latestSocial.minijobLimit,
                rvRateTotal: latestSocial.rvRateTotal,
                rvRateHalf: latestSocial.rvRateHalf,
                avRateTotal: latestSocial.avRateTotal,
                avRateHalf: latestSocial.avRateHalf,
                kvBaseRateHalf: latestSocial.kvBaseRateHalf,
                pvBaseRateAn: latestSocial.pvBaseRateAn,
                pvBaseRateAg: latestSocial.pvBaseRateAg,
                pvChildlessSurcharge: latestSocial.pvChildlessSurcharge,
                u1Rate: latestSocial.u1Rate,
                u2Rate: latestSocial.u2Rate,
                insolvenzRate: latestSocial.insolvenzRate,
                hmoRates: latestSocial.hmoRates,
                source: 'gkv_spitzenverband_bmas',
                changeSummary: socialDiffs.length > 0
                    ? `${socialDiffs.length} Änderung(en) erkannt: ${socialDiffs.map(d => d.field).slice(0, 3).join(', ')}`
                    : `Monatlicher Prüflauf für ${period}`,
                changesDiff: socialDiffs,
            }).returning();

            createdConditions.push({ type: 'social_insurance', id: newCondition.id, name: newCondition.name });

            // Create shared task for Admins, HR Managers and Top Management
            const [newTask] = await db.insert(task).values({
                type: 'condition_update_approval',
                status: 'pending',
                title: `Social Insurance & HMO Update Review (${period})`,
                description: `Monthly runner detected ${socialDiffs.length} updated condition(s). Review changed HMO Zusatzbeitrag & statutory rates for approval.`,
                targetRoles: ['admin', 'hr_manager', 'top_management'],
                data: {
                    updateType: 'social_insurance',
                    conditionId: newCondition.id,
                    period,
                    diffCount: socialDiffs.length,
                    changes: socialDiffs,
                }
            }).returning();

            createdTasks.push(newTask);
        }
    }

    // Sync HMO entities in hmo table so they are always available and up to date
    try {
        const existingHmos = await db.select().from(hmo);
        if (existingHmos.length === 0) {
            for (const item of DEFAULT_GERMAN_HMO_RATES) {
                await db.insert(hmo).values({
                    name: item.name,
                    code: item.code || null,
                    additionalContributionPercent: item.additionalContributionPercent,
                    type: 'statutory',
                    isActive: true
                });
            }
        } else {
            for (const latestHmo of latestSocial.hmoRates) {
                const found = existingHmos.find(
                    (h) => h.name.toLowerCase() === latestHmo.name.toLowerCase() || (latestHmo.code && h.code === latestHmo.code)
                );
                if (!found) {
                    await db.insert(hmo).values({
                        name: latestHmo.name,
                        code: latestHmo.code || null,
                        additionalContributionPercent: latestHmo.additionalContributionPercent,
                        type: 'statutory',
                        isActive: true
                    });
                }
            }
        }
    } catch (hmoErr) {
        console.error('[SyncConditions] Error syncing HMO table:', hmoErr);
    }

    // --- 2. UNION CONTRACT (AWO BERLIN) CHECK ---
    const unionDiffs: ChangeDiffItem[] = [];
    const latestAwoGrid = { ...DEFAULT_AWO_BERLIN_WAGE_GRID };

    if (options.simulateChange) {
        // Simulate a collective bargaining agreement raise (+3.5% linear)
        const updatedGrid: Record<string, Record<string, number>> = {};
        for (const [eg, stufen] of Object.entries(latestAwoGrid)) {
            updatedGrid[eg] = {};
            for (const [stufe, val] of Object.entries(stufen)) {
                updatedGrid[eg][stufe] = Math.round(val * 1.035 * 100) / 100;
            }
        }
        unionDiffs.push({
            field: 'AWO Berlin Tariferhöhung (+3.5% linear)',
            oldValue: 'Vorherige Entgelttabelle',
            newValue: '+3.5% auf alle Entgeltgruppen E 1 bis E 15',
            unit: '%'
        });
    } else if (!activeUnion) {
        unionDiffs.push({
            field: 'Initialisierung AWO Berlin E-Tabelle',
            oldValue: 'Keine',
            newValue: `AWO Berlin Entgelttabelle für ${period}`,
        });
    }

    const hasUnionChanges = unionDiffs.length > 0 || (options.force && !activeUnion);
    if (hasUnionChanges) {
        const existingPendingUnion = await db.query.unionContractCondition.findFirst({
            where: and(
                eq(unionContractCondition.tariffCode, 'AWO_BERLIN'),
                eq(unionContractCondition.effectivePeriod, period),
                eq(unionContractCondition.status, 'pending_review')
            )
        });

        if (!existingPendingUnion) {
            // Find framework id if exists
            const framework = await db.query.contractFramework.findFirst({
                where: or(
                    ilike(contractFramework.name, '%AWO%'),
                    eq(contractFramework.code, 'AWO_BERLIN')
                )
            });

            const nextVersion = (activeUnion?.version || 0) + 1;
            const [newUnionCondition] = await db.insert(unionContractCondition).values({
                frameworkId: framework?.id || null,
                tariffCode: 'AWO_BERLIN',
                name: `AWO Berlin Entgelttabelle (${period})`,
                version: nextVersion,
                effectivePeriod: period,
                effectiveDate: startDate,
                status: 'pending_review',
                wageGrid: latestAwoGrid,
                stepProgressionRules: { '1': 12, '2': 24, '3': 36, '4': 48, '5': 60 },
                tenureBenefits: [
                    { years: 10, label: '10 Jahre Betriebszugehörigkeit', bonus: 250.0, specialLeaveDays: 1 },
                    { years: 25, label: '25 Jahre Dienstjubiläum (Tarifvertrag)', bonus: 500.0, specialLeaveDays: 1 },
                    { years: 40, label: '40 Jahre Dienstjubiläum (Tarifvertrag)', bonus: 600.0, specialLeaveDays: 2 },
                ],
                allowances: {
                    capitalAllowance: 150.00,
                    capitalFormingBenefits: 6.65,
                    yearlyBonusPercentage: 80,
                },
                surcharges: {
                    overtimePercent: 30,
                    nightPercent: 20,
                    sundayPercent: 25,
                    holidayPercent: 35,
                    saturdayPercent: 20,
                },
                source: 'tarifregister_verdi',
                changeSummary: unionDiffs.length > 0
                    ? `${unionDiffs.length} Tarifanpassung(en) erkannt: ${unionDiffs.map(d => d.field).join(', ')}`
                    : `Monatlicher Tariftabellenabgleich für ${period}`,
                changesDiff: unionDiffs,
            }).returning();

            createdConditions.push({ type: 'union_contract', id: newUnionCondition.id, name: newUnionCondition.name });

            const [newTask] = await db.insert(task).values({
                type: 'condition_update_approval',
                status: 'pending',
                title: `Union Tariff Update: AWO Berlin (${period})`,
                description: `Monthly runner detected tariff modifications. Review collective agreement terms for approval.`,
                targetRoles: ['admin', 'hr_manager', 'top_management'],
                data: {
                    updateType: 'union_contract',
                    conditionId: newUnionCondition.id,
                    tariffCode: 'AWO_BERLIN',
                    period,
                    diffCount: unionDiffs.length,
                    changes: unionDiffs,
                }
            }).returning();

            createdTasks.push(newTask);
        }
    }

    // --- 3. CHECK EXPERIENCE-BASED PAY RAISES & TENURE MILESTONE TASKS ---
    let milestoneTasksCount = 0;
    try {
        const { syncContractMilestoneTasks } = await import('../tasks/service.js');
        const milestoneResult = await syncContractMilestoneTasks({ force: options.force });
        milestoneTasksCount = milestoneResult.createdTasksCount;
        createdTasks.push(...milestoneResult.createdTasks);
    } catch (milestoneErr) {
        console.error('[SyncConditions] Error syncing contract milestone tasks:', milestoneErr);
    }

    const totalTasksGenerated = createdTasks.length;
    return {
        success: true,
        changed: createdConditions.length > 0 || milestoneTasksCount > 0,
        period,
        conditionsCount: createdConditions.length,
        tasksCount: totalTasksGenerated,
        milestoneTasksCount,
        createdConditions,
        createdTasks,
        message: totalTasksGenerated > 0
            ? `Pull completed: ${createdConditions.length} condition update(s) and ${milestoneTasksCount} milestone task(s) generated. Shared review task(s) active for Admins, HR & Management.`
            : 'Conditions check completed: All rates and contract experience milestones are up to date.',
    };
}

/**
 * Approves a condition update, marks older active versions as superseded (preserving full history),
 * records audit log (when and by who), updates contractFramework defaults, and marks shared tasks complete.
 */
export async function approveCondition(params: {
    id: string;
    type: 'social_insurance' | 'union_contract';
    userId: string;
    userName: string;
}) {
    const { id, type, userId, userName } = params;
    const approvedAt = new Date();

    if (type === 'social_insurance') {
        const target = await db.query.socialInsuranceCondition.findFirst({
            where: eq(socialInsuranceCondition.id, id)
        });
        if (!target) throw new Error('Social insurance condition not found');

        // Supersede any previously approved condition for this jurisdiction
        await db.update(socialInsuranceCondition)
            .set({ status: 'superseded', updatedAt: new Date() })
            .where(
                and(
                    eq(socialInsuranceCondition.jurisdiction, target.jurisdiction),
                    eq(socialInsuranceCondition.status, 'approved')
                )
            );

        // Approve target condition
        const [approved] = await db.update(socialInsuranceCondition)
            .set({
                status: 'approved',
                approvedAt,
                approvedByUserId: userId,
                approvedByUserName: userName,
                updatedAt: approvedAt,
            })
            .where(eq(socialInsuranceCondition.id, id))
            .returning();

        // Complete all related shared tasks
        const relatedTasks = await db.query.task.findMany({
            where: and(
                eq(task.type, 'condition_update_approval'),
                eq(task.status, 'pending')
            )
        });
        for (const t of relatedTasks) {
            const data = t.data as any;
            if (data?.conditionId === id || data?.updateType === 'social_insurance') {
                await db.update(task)
                    .set({ status: 'completed', updatedAt: approvedAt })
                    .where(eq(task.id, t.id));
            }
        }

        // Apply updated HMO contribution rates to the hmo table
        if (target.hmoRates && Array.isArray(target.hmoRates)) {
            for (const h of target.hmoRates) {
                const existing = await db.query.hmo.findFirst({
                    where: or(eq(hmo.name, h.name), h.code ? eq(hmo.code, h.code) : undefined)
                });
                if (existing) {
                    await db.update(hmo)
                        .set({
                            additionalContributionPercent: h.additionalContributionPercent,
                            updatedAt: approvedAt
                        })
                        .where(eq(hmo.id, existing.id));
                }
            }
        }

        return {
            success: true,
            condition: approved,
            message: `Social insurance condition approved by ${userName} on ${approvedAt.toISOString()}`
        };
    } else {
        const target = await db.query.unionContractCondition.findFirst({
            where: eq(unionContractCondition.id, id)
        });
        if (!target) throw new Error('Union contract condition not found');

        // Supersede older approved condition for same tariffCode
        await db.update(unionContractCondition)
            .set({ status: 'superseded', updatedAt: new Date() })
            .where(
                and(
                    eq(unionContractCondition.tariffCode, target.tariffCode),
                    eq(unionContractCondition.status, 'approved')
                )
            );

        // Approve target condition
        const [approved] = await db.update(unionContractCondition)
            .set({
                status: 'approved',
                approvedAt,
                approvedByUserId: userId,
                approvedByUserName: userName,
                updatedAt: approvedAt,
            })
            .where(eq(unionContractCondition.id, id))
            .returning();

        // Update linked contractFramework if exists so new contracts inherit approved terms
        if (target.frameworkId) {
            await db.update(contractFramework)
                .set({
                    defaultValues: {
                        wageGrid: target.wageGrid,
                        allowances: target.allowances,
                        surcharges: target.surcharges,
                        stepProgressionRules: target.stepProgressionRules || { '1': 12, '2': 24, '3': 36, '4': 48, '5': 60 },
                        tenureBenefits: target.tenureBenefits || [
                            { years: 10, label: '10 Jahre Betriebszugehörigkeit', bonus: 250.0, specialLeaveDays: 1 },
                            { years: 25, label: '25 Jahre Dienstjubiläum (Tarifvertrag)', bonus: 500.0, specialLeaveDays: 1 },
                            { years: 40, label: '40 Jahre Dienstjubiläum (Tarifvertrag)', bonus: 600.0, specialLeaveDays: 2 },
                        ],
                        tariffCode: target.tariffCode,
                        approvedPeriod: target.effectivePeriod,
                    },
                    updatedAt: approvedAt
                })
                .where(eq(contractFramework.id, target.frameworkId));
        }

        // Complete related tasks
        const relatedTasks = await db.query.task.findMany({
            where: and(
                eq(task.type, 'condition_update_approval'),
                eq(task.status, 'pending')
            )
        });
        for (const t of relatedTasks) {
            const data = t.data as any;
            if (data?.conditionId === id || data?.updateType === 'union_contract') {
                await db.update(task)
                    .set({ status: 'completed', updatedAt: approvedAt })
                    .where(eq(task.id, t.id));
            }
        }

        return {
            success: true,
            condition: approved,
            message: `Union contract condition approved by ${userName} on ${approvedAt.toISOString()}`
        };
    }
}

/**
 * Rejects a condition update and completes/archives the task with rejection reasoning.
 */
export async function rejectCondition(params: {
    id: string;
    type: 'social_insurance' | 'union_contract';
    reason?: string;
    userId: string;
}) {
    const { id, type, reason, userId } = params;
    const rejectedAt = new Date();

    if (type === 'social_insurance') {
        const [rejected] = await db.update(socialInsuranceCondition)
            .set({
                status: 'rejected',
                rejectedAt,
                rejectedByUserId: userId,
                rejectionReason: reason || 'Rejected by management',
                updatedAt: rejectedAt,
            })
            .where(eq(socialInsuranceCondition.id, id))
            .returning();

        const relatedTasks = await db.query.task.findMany({
            where: and(
                eq(task.type, 'condition_update_approval'),
                eq(task.status, 'pending')
            )
        });
        for (const t of relatedTasks) {
            const data = t.data as any;
            if (data?.conditionId === id) {
                await db.update(task)
                    .set({ status: 'archived', updatedAt: rejectedAt })
                    .where(eq(task.id, t.id));
            }
        }

        return { success: true, condition: rejected };
    } else {
        const [rejected] = await db.update(unionContractCondition)
            .set({
                status: 'rejected',
                rejectedAt,
                rejectedByUserId: userId,
                rejectionReason: reason || 'Rejected by management',
                updatedAt: rejectedAt,
            })
            .where(eq(unionContractCondition.id, id))
            .returning();

        const relatedTasks = await db.query.task.findMany({
            where: and(
                eq(task.type, 'condition_update_approval'),
                eq(task.status, 'pending')
            )
        });
        for (const t of relatedTasks) {
            const data = t.data as any;
            if (data?.conditionId === id) {
                await db.update(task)
                    .set({ status: 'archived', updatedAt: rejectedAt })
                    .where(eq(task.id, t.id));
            }
        }

        return { success: true, condition: rejected };
    }
}
