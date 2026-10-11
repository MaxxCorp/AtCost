import { pgTable, text, timestamp, uuid, jsonb, doublePrecision, integer, boolean } from "drizzle-orm/pg-core";
import { talent } from "./talents";
import { contract } from "./contracts";

export const payrollRun = pgTable("payroll_run", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    period: text("period").notNull(), // e.g. "2026-10" (YYYY-MM)
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date").notNull(),
    jurisdiction: text("jurisdiction").default("DE").notNull(), // 'DE', 'AT', 'CH', etc.
    status: text("status", { enum: ["draft", "calculated", "approved", "finalized", "cancelled"] }).default("draft").notNull(),
    targetGroup: text("target_group", { enum: ["all", "tagged", "salaried", "hourly"] }).default("all").notNull(),
    tagIds: jsonb("tag_ids").$type<string[]>().default([]).notNull(),
    cycleType: text("cycle_type", { enum: ["monthly", "weekly", "biweekly", "custom"] }).default("monthly").notNull(),
    paymentDueDate: timestamp("payment_due_date"),
    totalGross: doublePrecision("total_gross").default(0).notNull(),
    totalNet: doublePrecision("total_net").default(0).notNull(),
    totalEmployerCost: doublePrecision("total_employer_cost").default(0).notNull(),
    totalJobcenterSubsidy: doublePrecision("total_jobcenter_subsidy").default(0).notNull(),
    totalNetEmployerCost: doublePrecision("total_net_employer_cost").default(0).notNull(),
    totalEmployees: integer("total_employees").default(0).notNull(),
    notes: text("notes"),
    calculatedAt: timestamp("calculated_at"),
    finalizedAt: timestamp("finalized_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const payrollProfile = pgTable("payroll_profile", {
    id: uuid("id").primaryKey().defaultRandom(),
    talentId: uuid("talent_id").notNull().references(() => talent.id, { onDelete: "cascade" }).unique(),
    taxId: text("tax_id"), // Steueridentifikationsnummer (11 digits)
    taxClass: text("tax_class", { enum: ["1", "2", "3", "4", "5", "6"] }).default("1").notNull(),
    childCount: doublePrecision("child_count").default(0).notNull(),
    churchTax: text("church_tax", { enum: ["none", "ev", "rk"] }).default("none").notNull(),
    state: text("state").default("BE").notNull(), // Bundesland (BE, BY, NW, BW, etc.)
    socialSecurityNumber: text("social_security_number"), // RV-Nummer / SV-Nummer
    healthInsuranceName: text("health_insurance_name").default("Techniker Krankenkasse (TK)").notNull(),
    healthInsuranceType: text("health_insurance_type", { enum: ["statutory", "private"] }).default("statutory").notNull(),
    healthInsuranceAdditionalContributionPercent: doublePrecision("health_insurance_additional_contribution_percent").default(2.5).notNull(),
    pensionInsuranceExempt: boolean("pension_insurance_exempt").default(false).notNull(),
    unemploymentInsuranceExempt: boolean("unemployment_insurance_exempt").default(false).notNull(),
    hasChildren: boolean("has_children").default(false).notNull(),
    employmentType: text("employment_type", { enum: ["regular", "minijob", "midijob", "student", "freelance", "sgb2_16d", "sgb2_16i"] }).default("regular").notNull(),
    fundingProgram: text("funding_program", { enum: ["none", "sgb2_16d", "sgb2_16i"] }).default("none"),
    fundingSubsidyPercentage: doublePrecision("funding_subsidy_percentage").default(100),
    fundingYear: integer("funding_year").default(1),
    jobcenterName: text("jobcenter_name"),
    jobcenterReference: text("jobcenter_reference"),
    furtherTrainingBudget: doublePrecision("further_training_budget").default(3000),
    furtherTrainingUsed: doublePrecision("further_training_used").default(0),
    coachingHoursPerMonth: doublePrecision("coaching_hours_per_month").default(2),
    deuevPersonengruppe: text("deuev_personengruppe").default("101"),
    deuevBeitragsgruppe: text("deuev_beitragsgruppe").default("1111"),
    iban: text("iban"),
    bic: text("bic"),
    bankName: text("bank_name"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const payslip = pgTable("payslip", {
    id: uuid("id").primaryKey().defaultRandom(),
    payrollRunId: uuid("payroll_run_id").notNull().references(() => payrollRun.id, { onDelete: "cascade" }),
    talentId: uuid("talent_id").notNull().references(() => talent.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id").references(() => contract.id, { onDelete: "set null" }),
    jurisdiction: text("jurisdiction").default("DE").notNull(),
    status: text("status", { enum: ["draft", "calculated", "approved", "paid"] }).default("calculated").notNull(),

    // Working time analysis
    contractHours: doublePrecision("contract_hours").default(0).notNull(),
    workedHours: doublePrecision("worked_hours").default(0).notNull(),
    overtimeHours: doublePrecision("overtime_hours").default(0).notNull(),
    nightHours: doublePrecision("night_hours").default(0).notNull(),
    sundayHours: doublePrecision("sunday_hours").default(0).notNull(),
    holidayHours: doublePrecision("holiday_hours").default(0).notNull(),
    paidLeaveHours: doublePrecision("paid_leave_hours").default(0).notNull(),

    // Gross components
    baseSalary: doublePrecision("base_salary").default(0).notNull(),
    hourlyWage: doublePrecision("hourly_wage").default(0).notNull(),
    overtimePay: doublePrecision("overtime_pay").default(0).notNull(),
    overtimeSurcharges: doublePrecision("overtime_surcharges").default(0).notNull(),
    nightSurchargesTaxFree: doublePrecision("night_surcharges_tax_free").default(0).notNull(),
    sundaySurchargesTaxFree: doublePrecision("sunday_surcharges_tax_free").default(0).notNull(),
    holidaySurchargesTaxFree: doublePrecision("holiday_surcharges_tax_free").default(0).notNull(),
    allowances: doublePrecision("allowances").default(0).notNull(),
    employerVl: doublePrecision("employer_vl").default(0).notNull(),
    bonus: doublePrecision("bonus").default(0).notNull(),
    otherAdditions: doublePrecision("other_additions").default(0).notNull(),
    grossSalary: doublePrecision("gross_salary").default(0).notNull(),
    taxableGross: doublePrecision("taxable_gross").default(0).notNull(),
    socialSecurityGross: doublePrecision("social_security_gross").default(0).notNull(),
    pensionGross: doublePrecision("pension_gross").default(0).notNull(),

    // Taxes
    wageTax: doublePrecision("wage_tax").default(0).notNull(),
    solidaritySurcharge: doublePrecision("solidarity_surcharge").default(0).notNull(),
    churchTax: doublePrecision("church_tax").default(0).notNull(),
    totalTax: doublePrecision("total_tax").default(0).notNull(),

    // Employee Social Security Contributions
    employeeHealthInsurance: doublePrecision("employee_health_insurance").default(0).notNull(),
    employeePensionInsurance: doublePrecision("employee_pension_insurance").default(0).notNull(),
    employeeUnemploymentInsurance: doublePrecision("employee_unemployment_insurance").default(0).notNull(),
    employeeLongTermCareInsurance: doublePrecision("employee_long_term_care_insurance").default(0).notNull(),
    totalEmployeeSocialSecurity: doublePrecision("total_employee_social_security").default(0).notNull(),

    // Net & Payout
    netSalary: doublePrecision("net_salary").default(0).notNull(),
    netDeductions: doublePrecision("net_deductions").default(0).notNull(),
    payoutAmount: doublePrecision("payout_amount").default(0).notNull(),

    // Employer Social Security Contributions & Levies
    employerHealthInsurance: doublePrecision("employer_health_insurance").default(0).notNull(),
    employerPensionInsurance: doublePrecision("employer_pension_insurance").default(0).notNull(),
    employerUnemploymentInsurance: doublePrecision("employer_unemployment_insurance").default(0).notNull(),
    employerLongTermCareInsurance: doublePrecision("employer_long_term_care_insurance").default(0).notNull(),
    employerLevies: doublePrecision("employer_levies").default(0).notNull(), // U1, U2, Insolvenzgeldumlage
    totalEmployerSocialSecurity: doublePrecision("total_employer_social_security").default(0).notNull(),
    totalEmployerCost: doublePrecision("total_employer_cost").default(0).notNull(),

    // SGB II Subsidies & Net Employer Cost
    fundingProgram: text("funding_program"),
    jobcenterSubsidy: doublePrecision("jobcenter_subsidy").default(0).notNull(),
    netEmployerCost: doublePrecision("net_employer_cost").default(0).notNull(),
    deuevPersonengruppe: text("deuev_personengruppe").default("101"),
    deuevBeitragsgruppe: text("deuev_beitragsgruppe").default("1111"),

    // Breakdown details
    lineItems: jsonb("line_items"),
    calculationDetails: jsonb("calculation_details"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type PayrollRun = typeof payrollRun.$inferSelect;
export type NewPayrollRun = typeof payrollRun.$inferInsert;
export type PayrollProfile = typeof payrollProfile.$inferSelect;
export type NewPayrollProfile = typeof payrollProfile.$inferInsert;
export type Payslip = typeof payslip.$inferSelect;
export type NewPayslip = typeof payslip.$inferInsert;
