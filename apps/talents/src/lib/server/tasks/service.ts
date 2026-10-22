import {
    db,
    task,
    taskTypeConfig,
    contract,
    talent,
    contractFramework,
    eq,
    and,
    or,
    desc,
    asc,
    inArray,
    sql,
    type Task,
    type TaskTypeConfig,
} from '@ac/db';
import {
    DEFAULT_AWO_BERLIN_WAGE_GRID,
    getEffectiveUnionContractCondition,
} from '#lib/server/conditions/service.js';
import { addMonths, addYears, differenceInDays, format } from 'date-fns';

export const DEFAULT_TASK_TYPE_CONFIGS: Array<Omit<TaskTypeConfig, 'id' | 'createdAt' | 'updatedAt'>> = [
    {
        taskType: 'experience_step_increase',
        name: 'Tariflicher Stufenaufstieg (Erfahrungsstufen)',
        description: 'Periodische Entgeltanpassungen bei Erreichen der tariflichen Stufenlaufzeit (z.B. TV-L, AWO).',
        leadTimeDays: 30,
        targetRoles: ['admin', 'hr_manager', 'top_management'],
        isEnabled: true,
        autoPromptDifferentialUpdate: true,
    },
    {
        taskType: 'tenure_anniversary',
        name: 'Dienstjubiläum & Beschäftigungszeit',
        description: 'Tarifliche Jubiläumszuwendungen und Sonderurlaubstage bei Erreichen von Dienstjahren.',
        leadTimeDays: 45,
        targetRoles: ['admin', 'hr_manager', 'top_management'],
        isEnabled: true,
        autoPromptDifferentialUpdate: true,
    },
    {
        taskType: 'condition_update_approval',
        name: 'Tarif- & HMO-Konditionen (Auto-Updater)',
        description: 'Freigabe von aktualisierten Krankenkassen-Zusatzbeiträgen und Tarifentgelttabellen.',
        leadTimeDays: 7,
        targetRoles: ['admin', 'hr_manager', 'top_management'],
        isEnabled: true,
        autoPromptDifferentialUpdate: false,
    },
    {
        taskType: 'probation_end',
        name: 'Ablauf der Probezeit',
        description: 'Prüfung und Übernahme in das unbefristete Arbeitsverhältnis nach Ablauf der Probezeit.',
        leadTimeDays: 30,
        targetRoles: ['admin', 'hr_manager', 'top_management'],
        isEnabled: true,
        autoPromptDifferentialUpdate: false,
    },
    {
        taskType: 'gdpr_obfuscation',
        name: 'DSGVO Selbstauskunft & Anonymisierung',
        description: 'Antrag auf Löschung / Anonymisierung personenbezogener Daten (Art. 17 DSGVO).',
        leadTimeDays: 30,
        targetRoles: ['admin', 'hr_manager', 'top_management'],
        isEnabled: true,
        autoPromptDifferentialUpdate: false,
    },
];

export const DEFAULT_STUFENLAUFZEIT_MAP: Record<number, number> = {
    1: 12, // Stufe 1 -> Stufe 2: 1 year (12 months)
    2: 24, // Stufe 2 -> Stufe 3: 2 years (24 months)
    3: 36, // Stufe 3 -> Stufe 4: 3 years (36 months)
    4: 48, // Stufe 4 -> Stufe 5: 4 years (48 months)
    5: 60, // Stufe 5 -> Stufe 6: 5 years (60 months)
};

export const DEFAULT_TENURE_MILESTONES = [
    { years: 10, label: '10 Jahre Betriebszugehörigkeit', bonus: 250.0, specialLeaveDays: 1 },
    { years: 25, label: '25 Jahre Dienstjubiläum (Tarifvertrag)', bonus: 500.0, specialLeaveDays: 1 },
    { years: 40, label: '40 Jahre Dienstjubiläum (Tarifvertrag)', bonus: 600.0, specialLeaveDays: 2 },
    { years: 50, label: '50 Jahre Dienstjubiläum', bonus: 800.0, specialLeaveDays: 2 },
];

function getContactDisplayName(contact: any): string {
    if (!contact) return 'Mitarbeiter/in';
    if (contact.displayName) return contact.displayName;
    const parts = [contact.givenName, contact.familyName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'Mitarbeiter/in';
}

/**
 * Ensures standard task type configurations exist in the database and returns them.
 */
export async function getOrSeedTaskTypeConfigs(): Promise<TaskTypeConfig[]> {
    const existing = await db.select().from(taskTypeConfig);
    if (existing.length >= DEFAULT_TASK_TYPE_CONFIGS.length) {
        return existing;
    }

    const existingTypes = new Set(existing.map((c) => c.taskType));
    const toInsert = DEFAULT_TASK_TYPE_CONFIGS.filter((c) => !existingTypes.has(c.taskType));

    if (toInsert.length > 0) {
        await db.insert(taskTypeConfig).values(toInsert as any);
    }

    return await db.select().from(taskTypeConfig).orderBy(asc(taskTypeConfig.name));
}

/**
 * Updates configuration settings for a given task type (e.g. lead time, enabled, roles).
 */
export async function updateTaskTypeConfigCore(input: {
    taskType: string;
    leadTimeDays: number;
    isEnabled: boolean;
    name?: string;
    targetRoles?: string[];
    autoPromptDifferentialUpdate?: boolean;
}) {
    const existing = await db.query.taskTypeConfig.findFirst({
        where: eq(taskTypeConfig.taskType, input.taskType),
    });

    if (!existing) {
        // Seed first
        await getOrSeedTaskTypeConfigs();
    }

    const [updated] = await db.update(taskTypeConfig)
        .set({
            leadTimeDays: input.leadTimeDays,
            isEnabled: input.isEnabled,
            name: input.name || existing?.name,
            targetRoles: input.targetRoles || existing?.targetRoles || ['admin', 'hr_manager', 'top_management'],
            autoPromptDifferentialUpdate: input.autoPromptDifferentialUpdate ?? existing?.autoPromptDifferentialUpdate ?? true,
            updatedAt: new Date(),
        })
        .where(eq(taskTypeConfig.taskType, input.taskType))
        .returning();

    return updated;
}

/**
 * Scans active union-based contracts for upcoming experience-based pay raises (Stufenaufstiege)
 * and employment tenure milestones (Dienstjubiläen) based on configured lead times.
 * Generates shared management tasks for Admins, HR Managers and Top Management.
 */
export async function syncContractMilestoneTasks(options: {
    force?: boolean;
    referenceDate?: Date;
    leadTimeDaysOverride?: number;
} = {}) {
    const refDate = options.referenceDate || new Date();
    const configs = await getOrSeedTaskTypeConfigs();
    const configMap = new Map(configs.map((c) => [c.taskType, c]));

    const stepConfig = configMap.get('experience_step_increase');
    const tenureConfig = configMap.get('tenure_anniversary');

    const createdTasks: any[] = [];
    let checkedContractsCount = 0;

    // Fetch active base contracts with talents and contacts
    const activeContracts = await db.query.contract.findMany({
        where: and(
            eq(contract.isActive, true),
            or(
                eq(contract.contractType, 'base_contract'),
                eq(contract.contractType, 'amendment')
            )
        ),
        with: {
            talent: {
                with: {
                    contact: true,
                },
            },
            frameworks: {
                with: {
                    framework: true,
                },
            },
        },
    });

    checkedContractsCount = activeContracts.length;

    // --- 1. EXPERIENCE-BASED PAY RAISES (STUFENAUFSTIEG) ---
    if (stepConfig && stepConfig.isEnabled) {
        const leadDays = options.leadTimeDaysOverride ?? stepConfig.leadTimeDays;

        for (const c of activeContracts) {
            // Need entgeltgruppe and current erfahrungsstufe
            if (!c.entgeltgruppe || typeof c.erfahrungsstufe !== 'number') continue;
            // Maximum standard stage is 6 (Endstufe)
            if (c.erfahrungsstufe >= 6) continue;

            const nextStufe = c.erfahrungsstufe + 1;
            let nextStepDate = c.nextStufenaufstiegDate ? new Date(c.nextStufenaufstiegDate) : null;
            const stepDuration = c.stufenlaufzeitMonths || DEFAULT_STUFENLAUFZEIT_MAP[c.erfahrungsstufe] || 12;

            // If not set, calculate from startDate
            if (!nextStepDate && c.startDate) {
                nextStepDate = addMonths(new Date(c.startDate), stepDuration);
                // Backfill onto contract record for consistency
                await db.update(contract)
                    .set({
                        nextStufenaufstiegDate: nextStepDate,
                        stufenlaufzeitMonths: stepDuration,
                        updatedAt: new Date(),
                    })
                    .where(eq(contract.id, c.id));
            }

            if (!nextStepDate) continue;

            // Calculate days until upgrade
            const daysRemaining = differenceInDays(nextStepDate, refDate);

            // Trigger when within lead time (grace period: -30 days overdue to leadDays in future)
            const isWithinLeadTime = daysRemaining <= leadDays && daysRemaining >= -30;

            if (isWithinLeadTime || options.force) {
                // Check if a pending task for this contract and nextStufe already exists
                const existingTask = await db.query.task.findFirst({
                    where: and(
                        eq(task.type, 'experience_step_increase'),
                        eq(task.status, 'pending')
                    ),
                });

                // Match in memory or via json data check
                const matchingTasks = await db.execute(sql`
                    SELECT id FROM "task"
                    WHERE "type" = 'experience_step_increase'
                    AND "status" = 'pending'
                    AND ("data"->>'contractId') = ${c.id}
                    AND ("data"->>'nextStufe') = ${String(nextStufe)}
                `);

                if (matchingTasks.length === 0) {
                    // Determine current and next wage using union condition wageGrid
                    const currentWage = Number(c.wageAmount) || 0;
                    let nextWage = currentWage;

                    const effectiveUnion = await getEffectiveUnionContractCondition(
                        c.wageTable || 'AWO_BERLIN',
                        nextStepDate
                    );
                    const wageGrid = (effectiveUnion?.wageGrid || DEFAULT_AWO_BERLIN_WAGE_GRID) as Record<string, Record<string, number>>;

                    if (wageGrid[c.entgeltgruppe] && wageGrid[c.entgeltgruppe][String(nextStufe)]) {
                        nextWage = wageGrid[c.entgeltgruppe][String(nextStufe)];
                    }

                    const deltaWage = Math.round((nextWage - currentWage) * 100) / 100;
                    const talentName = getContactDisplayName(c.talent?.contact);

                    const formattedDate = format(nextStepDate, 'dd.MM.yyyy');
                    const [newTask] = await db.insert(task).values({
                        type: 'experience_step_increase',
                        status: 'pending',
                        title: `Stufenaufstieg: ${talentName} (${c.entgeltgruppe} Stufe ${c.erfahrungsstufe} ➔ Stufe ${nextStufe})`,
                        description: `Tariflicher Stufenaufstieg fällig am ${formattedDate} (in ${daysRemaining >= 0 ? daysRemaining : 0} Tagen). Vorgeschlagene Entgelterhöhung von ${currentWage.toFixed(2)} € auf ${nextWage.toFixed(2)} € (${deltaWage >= 0 ? '+' : ''}${deltaWage.toFixed(2)} €/Monat). Differenziellen Änderungsvertrag erstellen.`,
                        targetRoles: stepConfig.targetRoles || ['admin', 'hr_manager', 'top_management'],
                        dueDate: nextStepDate,
                        data: {
                            updateType: 'experience_step_increase',
                            contractId: c.id,
                            talentId: c.talentId,
                            talentName,
                            entgeltgruppe: c.entgeltgruppe,
                            currentStufe: c.erfahrungsstufe,
                            nextStufe,
                            currentWage,
                            nextWage,
                            deltaWage,
                            effectiveDate: nextStepDate.toISOString(),
                            daysRemaining,
                            wageTable: c.wageTable || 'AWO Berlin (E-Tabelle)',
                            stufenlaufzeitMonths: stepDuration,
                            leadTimeDays: leadDays,
                            autoPromptDifferentialUpdate: stepConfig.autoPromptDifferentialUpdate,
                        },
                    }).returning();

                    createdTasks.push(newTask);
                }
            }
        }
    }

    // --- 2. EMPLOYMENT TIME & ANNIVERSARY BENEFITS (DIENSTJUBILÄUM) ---
    if (tenureConfig && tenureConfig.isEnabled) {
        const leadDays = options.leadTimeDaysOverride ?? tenureConfig.leadTimeDays;

        for (const c of activeContracts) {
            if (!c.startDate) continue;
            const startDate = new Date(c.startDate);

            for (const milestone of DEFAULT_TENURE_MILESTONES) {
                const anniversaryDate = addYears(startDate, milestone.years);
                const daysRemaining = differenceInDays(anniversaryDate, refDate);

                if (daysRemaining <= leadDays && daysRemaining >= -30) {
                    const matchingTasks = await db.execute(sql`
                        SELECT id FROM "task"
                        WHERE "type" = 'tenure_anniversary'
                        AND "status" = 'pending'
                        AND ("data"->>'talentId') = ${c.talentId}
                        AND ("data"->>'milestoneYears') = ${String(milestone.years)}
                    `);

                    if (matchingTasks.length === 0) {
                        const talentName = getContactDisplayName(c.talent?.contact);

                        const formattedDate = format(anniversaryDate, 'dd.MM.yyyy');
                        const [newTask] = await db.insert(task).values({
                            type: 'tenure_anniversary',
                            status: 'pending',
                            title: `Dienstjubiläum: ${talentName} (${milestone.years} Jahre Betriebszugehörigkeit)`,
                            description: `Der/die Mitarbeiter/in erreicht am ${formattedDate} das ${milestone.years}-jährige Dienstjubiläum. Tarifliche Zuwendung (${milestone.bonus} €) und ${milestone.specialLeaveDays} Sonderurlaubstag(e) veranlassen.`,
                            targetRoles: tenureConfig.targetRoles || ['admin', 'hr_manager', 'top_management'],
                            dueDate: anniversaryDate,
                            data: {
                                updateType: 'tenure_benefit',
                                contractId: c.id,
                                talentId: c.talentId,
                                talentName,
                                milestoneYears: milestone.years,
                                anniversaryDate: anniversaryDate.toISOString(),
                                bonus: milestone.bonus,
                                specialLeaveDays: milestone.specialLeaveDays,
                                daysRemaining,
                                leadTimeDays: leadDays,
                            },
                        }).returning();

                        createdTasks.push(newTask);
                    }
                }
            }
        }
    }

    return {
        success: true,
        checkedContractsCount,
        createdTasksCount: createdTasks.length,
        createdTasks,
    };
}

/**
 * Issues a differential contract update (amendment contract) based on a step increase or tenure milestone.
 * Automatically layers an amendment contract, updates the next step timeline, queues reporting hooks,
 * and completes the shared review task.
 */
export async function issueDifferentialContractUpdateCore(params: {
    taskId: string;
    contractId: string;
    talentId: string;
    effectiveDate: string | Date;
    newEntgeltgruppe?: string;
    newStufe: number;
    newWageAmount: number;
    notes?: string;
    scheduleReport?: boolean;
    userId?: string;
    userName?: string;
}) {
    const {
        taskId,
        contractId,
        talentId,
        effectiveDate,
        newEntgeltgruppe,
        newStufe,
        newWageAmount,
        notes,
        scheduleReport,
        userName = 'Management User',
    } = params;

    const effDate = typeof effectiveDate === 'string' ? new Date(effectiveDate) : effectiveDate;

    // 1. Fetch base contract
    const baseContract = await db.query.contract.findFirst({
        where: eq(contract.id, contractId),
    });
    if (!baseContract) throw new Error('Contract not found');

    const talentRecord = await db.query.talent.findFirst({
        where: eq(talent.id, talentId),
        with: { contact: true },
    });

    const talentName = getContactDisplayName(talentRecord?.contact);

    const currentWage = Number(baseContract.wageAmount) || 0;
    const wageDelta = Math.round((newWageAmount - currentWage) * 100) / 100;
    const resolvedEntgeltgruppe = newEntgeltgruppe || baseContract.entgeltgruppe || 'E 9b';

    // 2. Compute subsequent step duration and date
    const subsequentDuration = DEFAULT_STUFENLAUFZEIT_MAP[newStufe] || 24;
    const subsequentNextDate = newStufe < 6 ? addMonths(effDate, subsequentDuration) : null;

    // 3. Create the amendment contract (Änderungsvereinbarung, Precedence 2)
    const newPrecedence = (baseContract.precedence ?? 1) + 1;
    const [amendment] = await db.insert(contract).values({
        talentId,
        title: `Änderungsvereinbarung: Stufenaufstieg ${resolvedEntgeltgruppe} Stufe ${newStufe}`,
        contractType: 'amendment',
        precedence: newPrecedence,
        parentContractId: baseContract.id,
        isActive: true,
        startDate: effDate,
        wageType: baseContract.wageType,
        wageTable: baseContract.wageTable,
        entgeltgruppe: resolvedEntgeltgruppe,
        erfahrungsstufe: newStufe,
        wageAmount: newWageAmount,
        stufenlaufzeitMonths: subsequentDuration,
        nextStufenaufstiegDate: subsequentNextDate,
        workHoursPerWeek: baseContract.workHoursPerWeek,
        workHoursPerDay: baseContract.workHoursPerDay,
        workHoursPerMonth: baseContract.workHoursPerMonth,
        workDaysPerWeek: baseContract.workDaysPerWeek,
        differentialAdjustments: {
            adjustmentType: 'experience_step_increase',
            previousStufe: baseContract.erfahrungsstufe,
            newStufe,
            previousWage: currentWage,
            newWage: newWageAmount,
            wageDelta,
            effectiveDate: effDate.toISOString(),
            notes: notes || 'Tariflicher Stufenaufstieg gem. TV-L / AWO Stufenlaufzeit',
            reportQueued: Boolean(scheduleReport),
            approvedBy: userName,
            approvedAt: new Date().toISOString(),
        },
    } as any).returning();

    // 4. Update the base contract timeline so subsequent automated checks look ahead to the next stage
    await db.update(contract)
        .set({
            erfahrungsstufe: newStufe,
            wageAmount: newWageAmount,
            stufenlaufzeitMonths: subsequentDuration,
            nextStufenaufstiegDate: subsequentNextDate,
            updatedAt: new Date(),
        })
        .where(eq(contract.id, baseContract.id));

    // 5. Complete the associated shared task
    const [updatedTask] = await db.update(task)
        .set({
            status: 'completed',
            updatedAt: new Date(),
            data: sql`
                COALESCE("data", '{}'::jsonb) || ${JSON.stringify({
                    resolution: 'differential_contract_issued',
                    amendmentContractId: amendment.id,
                    newStufe,
                    newWageAmount,
                    wageDelta,
                    reportQueued: Boolean(scheduleReport),
                    completedBy: userName,
                    completedAt: new Date().toISOString(),
                })}::jsonb
            `,
        })
        .where(eq(task.id, taskId))
        .returning();

    return {
        success: true,
        amendmentContract: amendment,
        task: updatedTask,
        message: `Änderungsvereinbarung für ${talentName} erfolgreich ausgestellt (+${wageDelta.toFixed(2)} €). Nächster Stufenaufstieg terminiert zum ${subsequentNextDate ? format(subsequentNextDate, 'dd.MM.yyyy') : 'Endstufe erreicht'}.${scheduleReport ? ' Bericht für Reporting-Feature vorgemerkt.' : ''}`,
    };
}
