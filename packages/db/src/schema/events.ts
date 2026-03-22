import { pgTable, text, timestamp, boolean, uuid, jsonb, index, primaryKey } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { contact } from "./contacts";
import { location, resource } from "./resources";
import { campaign } from "./campaigns";

// --- EVENT TABLES ---

export const recurringSeries = pgTable("recurring_series", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    rrule: text("rrule").notNull(),
    anchorDate: timestamp("anchor_date").notNull(),
    anchorEndDate: timestamp("anchor_end_date"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const event = pgTable("event", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    seriesId: uuid("series_id").references((): AnyPgColumn => recurringSeries.id, { onDelete: "cascade" }),
    summary: text("summary").notNull(),
    description: text("description"),
    location: text("location"),
    startDateTime: timestamp("start_date_time"),
    startTimeZone: text("start_time_zone"),
    endDateTime: timestamp("end_date_time"),
    endTimeZone: text("end_time_zone"),
    isAllDay: boolean("is_all_day").default(false).notNull(),
    status: text("status").default("confirmed").notNull(),
    recurrence: jsonb("recurrence").$type<string[]>(),
    recurringEventId: uuid("recurring_event_id").references((): AnyPgColumn => event.id, { onDelete: "cascade" }),
    originalStartTime: jsonb("original_start_time"),
    isException: boolean("is_exception").default(false).notNull(),
    isPublic: boolean("is_public").default(false).notNull(),
    guestsCanInviteOthers: boolean("guests_can_invite_others").default(true).notNull(),
    guestsCanModify: boolean("guests_can_modify").default(false).notNull(),
    guestsCanSeeOtherGuests: boolean("guests_can_see_other_guests").default(true).notNull(),
    campaignId: uuid("campaign_id").references(() => campaign.id, { onDelete: "set null" }),
    ticketPrice: text("ticket_price"),
    categoryBerlinDotDe: text("category_berlin_de"),
    qrCodePath: text("qrcode_path"),
    iCalPath: text("ical_path"),
    iCalUID: text("ical_uid"),
    attendees: jsonb("attendees"),
    reminders: jsonb("reminders").$type<{ useDefault?: boolean; overrides?: any[] }>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
    index("event_user_id_idx").on(table.userId),
]);

export const eventContact = pgTable("event_contact", {
    eventId: uuid("event_id").notNull().references(() => event.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").notNull().references(() => contact.id, { onDelete: "cascade" }),
    participationStatus: text("participation_status").default("needsAction").notNull(),
}, (table) => [primaryKey({ columns: [table.eventId, table.contactId] })]);

export const eventLocation = pgTable("event_location", {
    eventId: uuid("event_id").notNull().references(() => event.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").notNull().references(() => location.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.eventId, table.locationId] })]);

export const eventResource = pgTable("event_resource", {
    eventId: uuid("event_id").notNull().references(() => event.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id").notNull().references(() => resource.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.eventId, table.resourceId] })]);

import { tag } from "./contacts";

export const eventTag = pgTable("event_tag", {
    eventId: uuid("event_id").notNull().references(() => event.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull().references(() => tag.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.eventId, table.tagId] })]);

export type Event = typeof event.$inferSelect;
export type NewEvent = typeof event.$inferInsert;
export type RecurringSeries = typeof recurringSeries.$inferSelect;
export type NewRecurringSeries = typeof recurringSeries.$inferInsert;
