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

