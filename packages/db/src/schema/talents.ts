import { pgTable, text, timestamp, uuid, jsonb, doublePrecision, primaryKey } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { contact } from "./contacts";
import { location } from "./resources";

// --- TALENT TABLES ---

export const talent = pgTable("talent", {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id").notNull().references(() => contact.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["active", "inactive", "applicant"] }).default("applicant").notNull(),
    jobTitle: text("job_title"),
    salaryExpectation: text("salary_expectation"),
    availabilityDate: timestamp("availability_date"),
    onboardingStatus: text("onboarding_status"),
    resumeUrl: text("resume_url"),
    source: text("source"),
    internalNotes: text("internal_notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
    jcNumber: text("jc_number"),
});

export const talentTimelineEntry = pgTable("talent_timeline_entry", {
    id: uuid("id").primaryKey().defaultRandom(),
    talentId: uuid("talent_id").notNull().references(() => talent.id, { onDelete: "cascade" }),
    addedByUserId: text("added_by_user_id"),
    title: text("title").notNull(),
    description: text("description"),
    date: timestamp("date").notNull(),
    type: text("type").notNull(),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
    data: jsonb("data"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

// --- TIMESHEET TABLES ---

export const shiftPlan = pgTable("shift_plan", {
    id: uuid("id").primaryKey().defaultRandom(),
    talentId: uuid("talent_id").notNull().references(() => talent.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").references(() => location.id, { onDelete: "set null" }),
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const shiftPlanTemplate = pgTable("shift_plan_template", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    locationId: uuid("location_id").references(() => location.id, { onDelete: "set null" }),
    schedule: jsonb("schedule"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const shiftPlanTemplateTalent = pgTable("shift_plan_template_talent", {
    templateId: uuid("template_id").notNull().references(() => shiftPlanTemplate.id, { onDelete: "cascade" }),
    talentId: uuid("talent_id").notNull().references(() => talent.id, { onDelete: "cascade" }),
    validFrom: timestamp("valid_from", { withTimezone: true }).defaultNow().notNull(), // temporary solution for changing timetables (e.g. reduced working hours via new contract)
}, (table) => [primaryKey({ columns: [table.templateId, table.talentId, table.validFrom]})]);

export const timesheetEntry = pgTable("timesheet_entry", {
    id: uuid("id").primaryKey().defaultRandom(),
    talentId: uuid("talent_id").notNull().references(() => talent.id, { onDelete: "cascade" }),
    shiftPlanId: uuid("shift_plan_id").references(() => shiftPlan.id, { onDelete: "set null" }),
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time"),
    status: text("status", { enum: ["pending", "approved", "rejected"] }).default("pending").notNull(),
    managerId: text("manager_id"),
    managerComment: text("manager_comment"),
    type: text("type", { enum: ["qr", "gps", "manual"] }).notNull(),
    locationId: uuid("location_id").references(() => location.id),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const timesheetAuditTrail = pgTable("timesheet_audit_trail", {
    id: uuid("id").primaryKey().defaultRandom(),
    timesheetEntryId: uuid("timesheet_entry_id").notNull().references(() => timesheetEntry.id, { onDelete: "cascade" }),
    changedByUserId: text("changed_by_user_id").notNull(),
    operation: text("operation", { enum: ["create", "update", "delete", "approve", "reject"] }).notNull(),
    previousData: jsonb("previous_data"),
    newData: jsonb("new_data"),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// --- TIME OFF TABLES ---
export const timeOffRequest = pgTable("time_off_request", {
    id: uuid("id").primaryKey().defaultRandom(),
    talentId: uuid("talent_id").notNull().references(() => talent.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["AZV", "Urlaub", "Krank", "Kind krank", "Tel. Krankmeldung", "Wichtiger Grund", "Unentschuldigt"] }).notNull(), // Weiterbildung might be valid as well. Since the code should be fail-safe, the enum could also be dropped.
    status: text("status", { enum: ["pending", "approved", "rejected"] }).default("pending").notNull(),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date").notNull(),
    reason: text("reason"),
    managerId: text("manager_id"),
    managerComment: text("manager_comment"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const timeOffBalance = pgTable("time_off_balance", {
    id: uuid("id").primaryKey().defaultRandom(),
    talentId: uuid("talent_id").notNull().references(() => talent.id, { onDelete: "cascade" }),
    year: doublePrecision("year").notNull(),
    totalDays: doublePrecision("total_days").notNull(),
    usedDays: doublePrecision("used_days").default(0).notNull(),
    pendingDays: doublePrecision("pending_days").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

// --- TASK TABLES ---
export const task = pgTable("task", {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type", { enum: ["timesheet_approval", "profile_update", "correction", "manual"] }).notNull(),
    status: text("status", { enum: ["pending", "completed", "archived"] }).default("pending").notNull(),
    assigneeId: uuid("assignee_id").notNull().references(() => talent.id, { onDelete: "cascade" }),
    creatorId: uuid("creator_id").references(() => talent.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    data: jsonb("data"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const userTalent = pgTable("user_talent", {
    userId: text("user_id").notNull(),
    talentId: uuid("talent_id").notNull().references(() => talent.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.userId, table.talentId] })]);

export const talentGroups = pgTable('talent_groups', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    type: text('type').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const talentGroupMembers = pgTable('talent_group_members', {
    groupId: uuid('group_id').notNull().references(() => talentGroups.id, { onDelete: 'cascade' }),
    talentId: uuid('talent_id').notNull().references(() => talent.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
},(table) => [primaryKey({ columns: [table.groupId, table.talentId] }),]);

export const talentTimetableConflicts = pgTable('talent_timetable_conflict', {
    id: uuid("id").primaryKey().defaultRandom(),
    talentId: uuid('talent_id').notNull().references(() => talent.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    day: timestamp('day', { mode: "date" }).notNull(),
    note: text('note'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const talentAzv = pgTable('talent_azv', {
    id: uuid("id").primaryKey().defaultRandom(),
    talentId: uuid('talent_id').notNull().references(() => talent.id, { onDelete: 'cascade' }),
    from: timestamp('from', { mode: "date" }).notNull(),
    usedOn: timestamp('used_on', { mode: "date" }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Talent = typeof talent.$inferSelect;
export type NewTalent = typeof talent.$inferInsert;
export type TalentTimelineEntry = typeof talentTimelineEntry.$inferSelect;
export type NewTalentTimelineEntry = typeof talentTimelineEntry.$inferInsert;
export type ShiftPlan = typeof shiftPlan.$inferSelect;
export type NewShiftPlan = typeof shiftPlan.$inferInsert;
export type TimesheetEntry = typeof timesheetEntry.$inferSelect;
export type NewTimesheetEntry = typeof timesheetEntry.$inferInsert;
export type TimesheetAuditTrail = typeof timesheetAuditTrail.$inferSelect;
export type NewTimesheetAuditTrail = typeof timesheetAuditTrail.$inferInsert;
export type TimeOffRequest = typeof timeOffRequest.$inferSelect;
export type NewTimeOffRequest = typeof timeOffRequest.$inferInsert;
export type TimeOffBalance = typeof timeOffBalance.$inferSelect;
export type NewTimeOffBalance = typeof timeOffBalance.$inferInsert;
export type UserTalent = typeof userTalent.$inferSelect;
export type NewUserTalent = typeof userTalent.$inferInsert;
export type ShiftPlanTemplate = typeof shiftPlanTemplate.$inferSelect;
export type TalentTimetableConflict = typeof talentTimetableConflicts.$inferSelect;
export type NewTalentTimetableConflict = typeof talentTimetableConflicts.$inferInsert;
export type TalentAzv = typeof talentAzv.$inferSelect;
export type NewTalentAzv = typeof talentAzv.$inferInsert;
export type NewShiftPlanTemplate = typeof shiftPlanTemplate.$inferInsert;
export type ShiftPlanTemplateTalent = typeof shiftPlanTemplateTalent.$inferSelect;
export type NewShiftPlanTemplateTalent = typeof shiftPlanTemplateTalent.$inferInsert;
export type Task = typeof task.$inferSelect;
export type NewTask = typeof task.$inferInsert;
