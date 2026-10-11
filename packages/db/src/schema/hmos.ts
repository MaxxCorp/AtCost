import { pgTable, text, timestamp, uuid, doublePrecision, boolean, jsonb } from "drizzle-orm/pg-core";

export const hmo = pgTable("hmo", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    code: text("code"),
    category: text("category", { enum: ["health", "accident", "pension", "other"] }).default("health").notNull(),
    type: text("type", { enum: ["statutory", "private"] }).default("statutory").notNull(),
    
    // Identification
    ikNumber: text("ik_number"), // Institutskennzeichen (IK)
    betriebsnummer: text("betriebsnummer"), // Betriebsnummer (BBNR)

    // Health Insurance & Social Levies (GKV / Einzugsstelle)
    additionalContributionPercent: doublePrecision("additional_contribution_percent").default(2.50).notNull(),
    u1Rates: jsonb("u1_rates").$type<Array<{ compensationPercent: number; contributionPercent: number }>>(),
    u1DefaultCompensationPercent: doublePrecision("u1_default_compensation_percent").default(70.0),
    u2Rate: doublePrecision("u2_rate").default(0.44),
    u3Rate: doublePrecision("u3_rate").default(0.15),

    // Accident Insurance (Berufsgenossenschaft / DGUV)
    accidentGefahrklasse: doublePrecision("accident_gefahrklasse"),
    accidentBeitragsfuss: doublePrecision("accident_beitragsfuss"),
    accidentGefahrtarifstelle: text("accident_gefahrtarifstelle"),
    accidentMemberNumber: text("accident_member_number"),
    accidentPin: text("accident_pin"),
    accidentAdditionalRate: doublePrecision("accident_additional_rate").default(0), // z.B. 0.08 € je 1.000 € (Ausgleichsumlage Wohlfahrtspflege der BGW)
    accidentAdditionalLabel: text("accident_additional_label"), // z.B. "Ausgleichsumlage Wohlfahrtspflege"

    // Supplementary Pension (Zusatzversorgung / ZVK / VBL / bAV)
    pensionEmployerPercent: doublePrecision("pension_employer_percent"),
    pensionEmployeePercent: doublePrecision("pension_employee_percent"),
    pensionMemberNumber: text("pension_member_number"),

    website: text("website"),
    notes: text("notes"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Hmo = typeof hmo.$inferSelect;
export type NewHmo = typeof hmo.$inferInsert;
