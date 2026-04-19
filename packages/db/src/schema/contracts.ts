import { pgTable, text, timestamp, uuid, jsonb, doublePrecision, primaryKey, integer } from "drizzle-orm/pg-core";
import { talent } from "./talents";

export const contractFramework = pgTable("contract_framework", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const contract = pgTable("contract", {
    id: uuid("id").primaryKey().defaultRandom(),
    talentId: uuid("talent_id").notNull().references(() => talent.id, { onDelete: "cascade" }),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date"),
    probationPeriodMonths: integer("probation_period_months"),
    workHoursPerDay: doublePrecision("work_hours_per_day"),
    workHoursPerWeek: doublePrecision("work_hours_per_week"),
    workHoursPerMonth: doublePrecision("work_hours_per_month"),
    workHoursPerYear: doublePrecision("work_hours_per_year"),
    wageType: text("wage_type", { enum: ["hourly", "monthly"] }).notNull(),
    wageAmount: doublePrecision("wage_amount"),
    entgeltgruppe: text("entgeltgruppe"),
    erfahrungsstufe: integer("erfahrungsstufe"),
    specialPaymentRules: jsonb("special_payment_rules"),
    yearlyBonus: text("yearly_bonus"),
    holidayAllotmentDays: integer("holiday_allotment_days"),
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
