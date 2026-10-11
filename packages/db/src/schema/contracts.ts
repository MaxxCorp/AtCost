import { pgTable, text, timestamp, uuid, jsonb, doublePrecision, primaryKey, integer, boolean } from "drizzle-orm/pg-core";
import { talent } from "./talents";

export const contractFramework = pgTable("contract_framework", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    code: text("code"),
    description: text("description"),
    isDefault: boolean("is_default").default(false).notNull(),
    defaultValues: jsonb("default_values"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const contract = pgTable("contract", {
    id: uuid("id").primaryKey().defaultRandom(),
    talentId: uuid("talent_id").notNull().references(() => talent.id, { onDelete: "cascade" }),
    title: text("title"),
    contractType: text("contract_type", { enum: ["base_contract", "amendment", "settlement", "addendum"] }).default("base_contract").notNull(),
    precedence: integer("precedence").default(1).notNull(),
    parentContractId: uuid("parent_contract_id").references((): any => contract.id, { onDelete: "set null" }),
    isActive: boolean("is_active").default(true).notNull(),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date"),
    probationPeriodMonths: integer("probation_period_months").default(6),
    noticePeriodRule: text("notice_period_rule").default("tv_standard"),
    customNoticePeriod: text("custom_notice_period"),
    workHoursPerDay: doublePrecision("work_hours_per_day"),
    workHoursPerWeek: doublePrecision("work_hours_per_week"),
    workHoursPerMonth: doublePrecision("work_hours_per_month"),
    workHoursPerYear: doublePrecision("work_hours_per_year"),
    workDaysPerWeek: doublePrecision("work_days_per_week").default(5),
    flextimeModel: text("flextime_model").default("standard"),
    eveDaysFree: boolean("eve_days_free").default(true),
    wageType: text("wage_type", { enum: ["hourly", "monthly"] }).default("monthly").notNull(),
    wageAmount: doublePrecision("wage_amount"),
    wageTable: text("wage_table").default("AWO Berlin (E-Tabelle)"),
    entgeltgruppe: text("entgeltgruppe"),
    erfahrungsstufe: integer("erfahrungsstufe"),
    stufenlaufzeitMonths: integer("stufenlaufzeit_months"),
    nextStufenaufstiegDate: timestamp("next_stufenaufstieg_date"),
    overtimeSurchargePercent: doublePrecision("overtime_surcharge_percent").default(30),
    nightSurchargePercent: doublePrecision("night_surcharge_percent").default(20),
    sundaySurchargePercent: doublePrecision("sunday_surcharge_percent").default(25),
    holidaySurchargePercent: doublePrecision("holiday_surcharge_percent").default(35),
    saturdaySurchargePercent: doublePrecision("saturday_surcharge_percent").default(20),
    capitalFormingBenefits: doublePrecision("capital_forming_benefits").default(6.65),
    capitalAllowance: doublePrecision("capital_allowance").default(150.00),
    specialPaymentRules: jsonb("special_payment_rules"),
    yearlyBonus: text("yearly_bonus"),
    yearlyBonusPercentage: doublePrecision("yearly_bonus_percentage").default(80),
    yearlyBonusMonth: integer("yearly_bonus_month").default(11),
    yearlyBonusLeaveConversion: boolean("yearly_bonus_leave_conversion").default(false),
    holidayAllotmentDays: integer("holiday_allotment_days").default(30),
    specialLeaveDays: integer("special_leave_days").default(0),
    differentialAdjustments: jsonb("differential_adjustments"),
    notes: text("notes"),
    fundingProgram: text("funding_program", { enum: ["none", "sgb2_16d", "sgb2_16i"] }).default("none"),
    fundingSubsidyPercentage: doublePrecision("funding_subsidy_percentage").default(100),
    furtherTrainingBudget: doublePrecision("further_training_budget").default(3000),
    furtherTrainingUsed: doublePrecision("further_training_used").default(0),
    coachingHoursPerMonth: doublePrecision("coaching_hours_per_month").default(2),
    jobcenterReference: text("jobcenter_reference"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const contractFrameworkContract = pgTable("contract_framework_contract", {
    contractId: uuid("contract_id").notNull().references(() => contract.id, { onDelete: "cascade" }),
    frameworkId: uuid("framework_id").notNull().references(() => contractFramework.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.contractId, table.frameworkId] })]);

export type ContractFramework = typeof contractFramework.$inferSelect;
export type NewContractFramework = typeof contractFramework.$inferInsert;
export type Contract = typeof contract.$inferSelect;
export type NewContract = typeof contract.$inferInsert;
export type ContractFrameworkContract = typeof contractFrameworkContract.$inferSelect;
export type NewContractFrameworkContract = typeof contractFrameworkContract.$inferInsert;

