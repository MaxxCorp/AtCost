import { pgTable, text, timestamp, uuid, jsonb, doublePrecision, integer } from "drizzle-orm/pg-core";
import { contractFramework } from "./contracts";

export const socialInsuranceCondition = pgTable("social_insurance_condition", {
    id: uuid("id").primaryKey().defaultRandom(),
    jurisdiction: text("jurisdiction").default("DE").notNull(),
    name: text("name").notNull(),
    version: integer("version").default(1).notNull(),
    effectivePeriod: text("effective_period").notNull(), // e.g. "2026-10" (YYYY-MM)
    effectiveDate: timestamp("effective_date").notNull(),
    status: text("status", { enum: ["pending_review", "approved", "superseded", "rejected"] }).default("pending_review").notNull(),

    // Statutory ceilings & general contribution rates
    bbgKvPvMonthly: doublePrecision("bbg_kv_pv_monthly").default(5812.50).notNull(),
    bbgRvAvMonthly: doublePrecision("bbg_rv_av_monthly").default(8450.00).notNull(),
    minijobLimit: doublePrecision("minijob_limit").default(538.00).notNull(),
    rvRateTotal: doublePrecision("rv_rate_total").default(0.186).notNull(),
    rvRateHalf: doublePrecision("rv_rate_half").default(0.093).notNull(),
    avRateTotal: doublePrecision("av_rate_total").default(0.026).notNull(),
    avRateHalf: doublePrecision("av_rate_half").default(0.013).notNull(),
    kvBaseRateHalf: doublePrecision("kv_base_rate_half").default(0.073).notNull(),
    pvBaseRateAn: doublePrecision("pv_base_rate_an").default(0.022).notNull(),
    pvBaseRateAg: doublePrecision("pv_base_rate_ag").default(0.018).notNull(),
    pvChildlessSurcharge: doublePrecision("pv_childless_surcharge").default(0.006).notNull(),
    u1Rate: doublePrecision("u1_rate").default(0.015).notNull(),
    u2Rate: doublePrecision("u2_rate").default(0.0045).notNull(),
    insolvenzRate: doublePrecision("insolvenz_rate").default(0.0006).notNull(),

    // HMO (Krankenkassen) individual rates: [{ name, code, additionalContributionPercent }]
    hmoRates: jsonb("hmo_rates").$type<Array<{
        name: string;
        code?: string;
        additionalContributionPercent: number;
    }>>(),

    // Audit and review metadata
    source: text("source").default("gkv_spitzenverband_bmas").notNull(),
    changeSummary: text("change_summary"),
    changesDiff: jsonb("changes_diff").$type<Array<{
        field: string;
        oldValue: any;
        newValue: any;
        unit?: string;
    }>>(),
    approvedAt: timestamp("approved_at"),
    approvedByUserId: text("approved_by_user_id"),
    approvedByUserName: text("approved_by_user_name"),
    rejectedAt: timestamp("rejected_at"),
    rejectedByUserId: text("rejected_by_user_id"),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const unionContractCondition = pgTable("union_contract_condition", {
    id: uuid("id").primaryKey().defaultRandom(),
    frameworkId: uuid("framework_id").references(() => contractFramework.id, { onDelete: "set null" }),
    tariffCode: text("tariff_code").notNull(), // e.g. "AWO_BERLIN", "TV_L"
    name: text("name").notNull(),
    version: integer("version").default(1).notNull(),
    effectivePeriod: text("effective_period").notNull(), // e.g. "2026-10"
    effectiveDate: timestamp("effective_date").notNull(),
    status: text("status", { enum: ["pending_review", "approved", "superseded", "rejected"] }).default("pending_review").notNull(),

    // Wage grid (e.g. Entgeltgruppe -> Stufe -> amount)
    wageGrid: jsonb("wage_grid").$type<Record<string, Record<string, number>>>(),
    allowances: jsonb("allowances").$type<{
        capitalAllowance?: number;
        capitalFormingBenefits?: number;
        yearlyBonusPercentage?: number;
        [key: string]: any;
    }>(),
    surcharges: jsonb("surcharges").$type<{
        overtimePercent?: number;
        nightPercent?: number;
        sundayPercent?: number;
        holidayPercent?: number;
        saturdayPercent?: number;
        [key: string]: any;
    }>(),

    // Periodic experience step advancement schedules (e.g. Stufe -> duration in months)
    stepProgressionRules: jsonb("step_progression_rules").$type<Record<string, number>>(),

    // Employment tenure & anniversary benefits (e.g. 10, 25, 40 years milestones)
    tenureBenefits: jsonb("tenure_benefits").$type<Array<{
        years: number;
        label: string;
        bonus?: number;
        specialLeaveDays?: number;
    }>>(),

    // Audit and review metadata
    source: text("source").default("tarifregister_verdi").notNull(),
    changeSummary: text("change_summary"),
    changesDiff: jsonb("changes_diff").$type<Array<{
        field: string;
        oldValue: any;
        newValue: any;
        unit?: string;
    }>>(),
    approvedAt: timestamp("approved_at"),
    approvedByUserId: text("approved_by_user_id"),
    approvedByUserName: text("approved_by_user_name"),
    rejectedAt: timestamp("rejected_at"),
    rejectedByUserId: text("rejected_by_user_id"),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type SocialInsuranceCondition = typeof socialInsuranceCondition.$inferSelect;
export type NewSocialInsuranceCondition = typeof socialInsuranceCondition.$inferInsert;
export type UnionContractCondition = typeof unionContractCondition.$inferSelect;
export type NewUnionContractCondition = typeof unionContractCondition.$inferInsert;
