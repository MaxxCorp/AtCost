import * as v from "valibot";
import { FilterableIdSchema, PaginationBaseSchema } from './pagination.js';

export const contractTypePicklist = v.picklist(["base_contract", "amendment", "settlement", "addendum"]);
export type ContractType = v.InferOutput<typeof contractTypePicklist>;

export const contractPaginationSchema = v.optional(v.object({
    ...PaginationBaseSchema.entries,
    talentId: FilterableIdSchema,
    frameworkId: FilterableIdSchema,
    contractType: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
}), {});

export const contractFrameworkSchema = v.object({
    id: v.optional(v.string()),
    name: v.pipe(v.string(), v.minLength(1, "Name is required")),
    code: v.optional(v.string()),
    description: v.optional(v.string()),
    isDefault: v.optional(v.boolean(), false),
    defaultValues: v.optional(v.any()),
});

export const contractBaseSchema = v.object({
    id: v.optional(v.string()),
    talentId: v.pipe(v.string(), v.minLength(1, "Talent is required")),
    title: v.optional(v.string()),
    contractType: v.optional(contractTypePicklist),
    precedence: v.optional(v.number()),
    parentContractId: v.optional(v.string()),
    isActive: v.optional(v.boolean(), false),
    startDate: v.pipe(v.string(), v.minLength(1, "Start date is required")),
    endDate: v.optional(v.string()),
    probationPeriodMonths: v.optional(v.number()),
    noticePeriodRule: v.optional(v.string()),
    customNoticePeriod: v.optional(v.string()),
    workHoursPerDay: v.optional(v.number()),
    workHoursPerWeek: v.optional(v.number()),
    workHoursPerMonth: v.optional(v.number()),
    workHoursPerYear: v.optional(v.number()),
    workDaysPerWeek: v.optional(v.number()),
    flextimeModel: v.optional(v.string()),
    eveDaysFree: v.optional(v.boolean(), false),
    wageType: v.picklist(["hourly", "monthly"]),
    wageAmount: v.optional(v.number()),
    wageTable: v.optional(v.string()),
    entgeltgruppe: v.optional(v.string()),
    erfahrungsstufe: v.optional(v.number()),
    stufenlaufzeitMonths: v.optional(v.number()),
    nextStufenaufstiegDate: v.optional(v.string()),
    overtimeSurchargePercent: v.optional(v.number()),
    nightSurchargePercent: v.optional(v.number()),
    sundaySurchargePercent: v.optional(v.number()),
    holidaySurchargePercent: v.optional(v.number()),
    saturdaySurchargePercent: v.optional(v.number()),
    capitalFormingBenefits: v.optional(v.number()),
    capitalAllowance: v.optional(v.number()),
    specialPaymentRules: v.optional(v.any()),
    yearlyBonus: v.optional(v.string()),
    yearlyBonusPercentage: v.optional(v.number()),
    yearlyBonusMonth: v.optional(v.number()),
    yearlyBonusLeaveConversion: v.optional(v.boolean(), false),
    holidayAllotmentDays: v.optional(v.number()),
    specialLeaveDays: v.optional(v.number()),
    differentialAdjustments: v.optional(v.any()),
    notes: v.optional(v.string()),
    frameworkIds: v.optional(v.array(v.string())),
    fundingProgram: v.optional(v.picklist(["none", "sgb2_16d", "sgb2_16i"]), "none"),
    fundingSubsidyPercentage: v.optional(v.number(), 100),
    furtherTrainingBudget: v.optional(v.number(), 3000),
    furtherTrainingUsed: v.optional(v.number(), 0),
    coachingHoursPerMonth: v.optional(v.number(), 2),
    jobcenterReference: v.optional(v.string()),
});

export const contractSchema = contractBaseSchema;

export const updateContractSchema = v.intersect([
    contractBaseSchema,
    v.object({ id: v.pipe(v.string(), v.minLength(1, "Contract ID is required")) })
]);

export type ContractInput = v.InferOutput<typeof contractSchema>;

// Collective Agreement (Tarifvertrag) Defaults & Presets
export const AWO_BERLIN_DEFAULTS = {
    contractType: "base_contract" as const,
    title: "Arbeitsvertrag (AWO Berlin MTV)",
    workHoursPerWeek: 39.0,
    workHoursPerDay: 7.8,
    workHoursPerMonth: 169.65,
    workDaysPerWeek: 5,
    holidayAllotmentDays: 30,
    specialLeaveDays: 0,
    probationPeriodMonths: 6,
    wageType: "monthly" as const,
    wageTable: "AWO Berlin (E-Tabelle)",
    entgeltgruppe: "E 9b",
    erfahrungsstufe: 1,
    stufenlaufzeitMonths: 12,
    yearlyBonusPercentage: 80,
    yearlyBonusMonth: 11,
    yearlyBonusLeaveConversion: false,
    overtimeSurchargePercent: 30,
    nightSurchargePercent: 20,
    sundaySurchargePercent: 25,
    holidaySurchargePercent: 35,
    saturdaySurchargePercent: 20,
    capitalAllowance: 150.0, // Hauptstadtzulage Berlin
    capitalFormingBenefits: 6.65, // VWL
    eveDaysFree: true,
    noticePeriodRule: "tv_standard",
    flextimeModel: "standard",
    precedence: 1,
    isActive: true,
    fundingProgram: "none" as const,
    fundingSubsidyPercentage: 100,
    furtherTrainingBudget: 0,
    furtherTrainingUsed: 0,
    coachingHoursPerMonth: 0,
    jobcenterReference: "",
};

export const TV_L_DEFAULTS = {
    contractType: "base_contract" as const,
    title: "Arbeitsvertrag (TV-L)",
    workHoursPerWeek: 39.4,
    workHoursPerDay: 7.88,
    workHoursPerMonth: 171.39,
    workDaysPerWeek: 5,
    holidayAllotmentDays: 30,
    specialLeaveDays: 0,
    probationPeriodMonths: 6,
    wageType: "monthly" as const,
    wageTable: "TV-L",
    entgeltgruppe: "E 9b",
    erfahrungsstufe: 1,
    stufenlaufzeitMonths: 12,
    yearlyBonusPercentage: 84.5,
    yearlyBonusMonth: 11,
    yearlyBonusLeaveConversion: false,
    overtimeSurchargePercent: 30,
    nightSurchargePercent: 20,
    sundaySurchargePercent: 25,
    holidaySurchargePercent: 35,
    saturdaySurchargePercent: 20,
    capitalAllowance: 150.0, // Berlin Hauptstadtzulage
    capitalFormingBenefits: 6.65,
    eveDaysFree: true,
    noticePeriodRule: "tv_standard",
    flextimeModel: "standard",
    precedence: 1,
    isActive: true,
    fundingProgram: "none" as const,
    fundingSubsidyPercentage: 100,
    furtherTrainingBudget: 0,
    furtherTrainingUsed: 0,
    coachingHoursPerMonth: 0,
    jobcenterReference: "",
};

// SGB II § 16i Teilhabe am Arbeitsmarkt (TaAM) Preset
export const SGB2_16I_DEFAULTS = {
    contractType: "base_contract" as const,
    title: "Arbeitsvertrag gem. § 16i SGB II (Teilhabe am Arbeitsmarkt)",
    fundingProgram: "sgb2_16i" as const,
    fundingSubsidyPercentage: 100, // 100% in year 1-2, 90% Y3, 80% Y4, 70% Y5
    furtherTrainingBudget: 3000.0, // Statutory ceiling: up to 3.000 € further training budget
    furtherTrainingUsed: 0.0,
    coachingHoursPerMonth: 2.0, // Obligatory paid release for ganzheitliches Coaching
    jobcenterReference: "Jobcenter Förderung § 16i SGB II",
    workHoursPerWeek: 39.0,
    workHoursPerDay: 7.8,
    workHoursPerMonth: 169.65,
    workDaysPerWeek: 5,
    holidayAllotmentDays: 30,
    specialLeaveDays: 0,
    probationPeriodMonths: 6,
    wageType: "monthly" as const,
    wageTable: "AWO Berlin (E-Tabelle)",
    entgeltgruppe: "E 2",
    erfahrungsstufe: 1,
    wageAmount: 2350.00,
    stufenlaufzeitMonths: 12,
    yearlyBonusPercentage: 80,
    yearlyBonusMonth: 11,
    yearlyBonusLeaveConversion: false,
    overtimeSurchargePercent: 30,
    nightSurchargePercent: 20,
    sundaySurchargePercent: 25,
    holidaySurchargePercent: 35,
    saturdaySurchargePercent: 20,
    capitalAllowance: 150.0,
    capitalFormingBenefits: 6.65,
    eveDaysFree: true,
    noticePeriodRule: "tv_standard",
    flextimeModel: "standard",
    precedence: 1,
    isActive: true,
    differentialAdjustments: {
        fundingProgram: "sgb2_16i",
        statutoryLegalBasis: "§ 16i SGB II i.V.m. § 27 Abs. 3 Nr. 5 SGB III",
        subsidySchedule: [
            { years: "1-2", percent: 100, label: "Monate 1–24: 100% Lohnkostenzuschuss + pauschalierte AG-SV" },
            { years: "3", percent: 90, label: "Monate 25–36: 90% Lohnkostenzuschuss + pauschalierte AG-SV" },
            { years: "4", percent: 80, label: "Monate 37–48: 80% Lohnkostenzuschuss + pauschalierte AG-SV" },
            { years: "5", percent: 70, label: "Monate 49–60: 70% Lohnkostenzuschuss + pauschalierte AG-SV" },
        ],
        deuevKeys: {
            personengruppe: "101",
            beitragsgruppe: "1101",
            notice: "Versicherungsfrei in der Arbeitslosenversicherung (ALV-frei)",
        },
        coachingNotice: "Verpflichtende bezahlte Freistellung für beschäftigungsbegleitendes Coaching im 1. Beschäftigungsjahr",
        furtherTrainingGrantMax: 3000.0,
    },
};

// SGB II § 16d Arbeitsgelegenheit (AGH / "Ein-Euro-Job") Preset
export const SGB2_16D_DEFAULTS = {
    contractType: "base_contract" as const,
    title: "Maßnahmevereinbarung gem. § 16d SGB II (Arbeitsgelegenheit / AGH)",
    fundingProgram: "sgb2_16d" as const,
    fundingSubsidyPercentage: 100,
    furtherTrainingBudget: 0.0,
    furtherTrainingUsed: 0.0,
    coachingHoursPerMonth: 0.0,
    jobcenterReference: "Jobcenter AGH-Maßnahme § 16d SGB II",
    workHoursPerWeek: 20.0, // Typischer Umfang 15-30 Std./Woche (Standard 20h)
    workHoursPerDay: 4.0,
    workHoursPerMonth: 86.67,
    workDaysPerWeek: 5,
    holidayAllotmentDays: 0, // Kein gesetzlicher Urlaub nach BUrlG
    specialLeaveDays: 20, // Teilnahmeunterbrechung mit MAE-Fortzahlung
    probationPeriodMonths: 0,
    wageType: "hourly" as const,
    wageAmount: 2.00, // Typische Mehraufwandsentschädigung (MAE) 1,50 - 3,00 €/Std.
    entgeltgruppe: "MAE",
    wageTable: "Jobcenter MAE",
    erfahrungsstufe: 1,
    stufenlaufzeitMonths: 0,
    yearlyBonusPercentage: 0,
    yearlyBonusMonth: 0,
    yearlyBonusLeaveConversion: false,
    overtimeSurchargePercent: 0,
    nightSurchargePercent: 0,
    sundaySurchargePercent: 0,
    holidaySurchargePercent: 0,
    saturdaySurchargePercent: 0,
    capitalAllowance: 0.0,
    capitalFormingBenefits: 0.0,
    eveDaysFree: true,
    noticePeriodRule: "measure_agreement",
    flextimeModel: "strict_attendance",
    precedence: 1,
    isActive: true,
    differentialAdjustments: {
        fundingProgram: "sgb2_16d",
        legalNature: "Kein Arbeitsverhältnis im Sinne des Arbeitsrechts (§ 16d Abs. 7 SGB II)",
        taxAndSvNotice: "Steuerfrei gem. § 3 Nr. 2 EStG und komplett sozialversicherungsfrei (DEÜV BGR 0000 / PGR 190)",
        maeCalculationNotice: "Auszahlung erfolgt strikt auf Basis der erfassten Teilnehmer-Anwesenheitsstunden",
    },
};

export const AENDERUNGSTARIFVERTRAG_PRESET = {
    contractType: "amendment" as const,
    title: "Änderungstarifvertrag (ÄTV)",
    precedence: 2,
    isActive: true,
    differentialAdjustments: {
        adjustmentType: "hours_or_terms",
        notes: "Tarifliche Änderung von Arbeitszeit- oder Rahmenbedingungen",
    }
};

export const TARIFEINIGUNG_RAISE_PRESET = {
    contractType: "settlement" as const,
    title: "Tarifeinigung (Entgeltanpassung)",
    precedence: 3,
    isActive: true,
    differentialAdjustments: {
        baseRaisePercent: 5.5,
        baseRaiseAmount: 200,
        oneTimePayments: [
            { amount: 1500, label: "Inflationsausgleichsprämie (Teil 1)" },
            { amount: 1500, label: "Inflationsausgleichsprämie (Teil 2)" }
        ],
        notes: "Tarifeinigung: Sockelbetrag 200 € und 5,5 % lineare Entgelterhöhung",
    }
};

/**
 * Resolves the effective, consolidated contract terms for an employee with multiple active contracts.
 * Applies contracts sorted in ascending precedence order (lowest first, highest overrides).
 */
export function resolveEffectiveContract(contracts: Array<any>, referenceDate: Date = new Date()) {
    if (!contracts || contracts.length === 0) return null;

    const refTime = referenceDate.getTime();

    // Filter active contracts valid on referenceDate
    const activeContracts = contracts.filter((c) => {
        if (c.isActive === false) return false;
        if (c.startDate) {
            const start = new Date(c.startDate).getTime();
            if (start > refTime) return false;
        }
        if (c.endDate) {
            const end = new Date(c.endDate).getTime();
            if (end < refTime) return false;
        }
        return true;
    });

    if (activeContracts.length === 0) return null;

    // Sort by precedence ascending (lower precedence applied first; higher supersedes)
    const sorted = [...activeContracts].sort((a, b) => {
        const precA = typeof a.precedence === 'number' ? a.precedence : 1;
        const precB = typeof b.precedence === 'number' ? b.precedence : 1;
        return precA - precB;
    });

    // Start with base merged contract
    const effective: any = {
        ...sorted[0],
        appliedContracts: [sorted[0].title || sorted[0].id],
        differentialRaisesApplied: [] as Array<any>,
    };

    // Layer remaining contracts in precedence order
    for (let i = 1; i < sorted.length; i++) {
        const layer = sorted[i];
        effective.appliedContracts.push(layer.title || layer.id);

        // Override non-null, non-undefined, non-empty fields
        for (const [key, val] of Object.entries(layer)) {
            if (key === 'id' || key === 'talentId' || key === 'createdAt' || key === 'updatedAt') continue;
            if (key === 'differentialAdjustments') {
                if (val && typeof val === 'object') {
                    const adj = val as any;
                    let currentWage = Number(effective.wageAmount) || 0;

                    // Apply base amount raise (Sockelbetrag) first
                    if (typeof adj.baseRaiseAmount === 'number' && adj.baseRaiseAmount > 0) {
                        currentWage += adj.baseRaiseAmount;
                        effective.differentialRaisesApplied.push({
                            type: 'amount',
                            value: adj.baseRaiseAmount,
                            fromContract: layer.title || layer.id,
                        });
                    }

                    // Then apply linear percentage raise
                    if (typeof adj.baseRaisePercent === 'number' && adj.baseRaisePercent > 0) {
                        currentWage = Math.round((currentWage * (1 + adj.baseRaisePercent / 100)) * 100) / 100;
                        effective.differentialRaisesApplied.push({
                            type: 'percent',
                            value: adj.baseRaisePercent,
                            fromContract: layer.title || layer.id,
                        });
                    }

                    effective.wageAmount = Math.round(currentWage * 100) / 100;
                }
            } else if (val !== undefined && val !== null && val !== '') {
                effective[key] = val;
            }
        }
    }

    effective.effectiveWageAmount = Number(effective.wageAmount) || 0;

    // Contracts that are superseded by the top precedence contract
    const highestContract = sorted[sorted.length - 1];
    const supersededContracts = sorted.slice(0, sorted.length - 1);

    return {
        effective,
        highestContract,
        activeContracts: sorted,
        supersededContracts,
        totalActive: sorted.length,
    };
}

