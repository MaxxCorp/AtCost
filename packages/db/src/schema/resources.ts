import { pgTable, text, timestamp, boolean, uuid, integer } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { contact } from "./contacts";

// --- RESOURCE TABLES ---

export const location = pgTable("location", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    roomId: text("room_id"),
    capacity: text("capacity"), 
    street: text("street"),
    houseNumber: text("house_number"),
    addressSuffix: text("address_suffix"),
    zip: text("zip"),
    city: text("city"),
    state: text("state"),
    country: text("country"),
    isPublic: boolean("is_public").default(false).notNull(),
    inclusivitySupport: text("inclusivity_support"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const resource = pgTable("resource", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").references(() => location.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    type: text("type").notNull(),
    status: text("status").default("available").notNull(),
    maxOccupancy: integer("max_occupancy"),
    allocationCalendars: jsonb("allocation_calendars"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

import { primaryKey, jsonb } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

export const resourceContact = pgTable("resource_contact", {
    resourceId: uuid("resource_id").notNull().references(() => resource.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").notNull().references(() => contact.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.resourceId, table.contactId] })]);

export const locationContact = pgTable("location_contact", {
    locationId: uuid("location_id").notNull().references(() => location.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").notNull().references(() => contact.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.locationId, table.contactId] })]);

export const resourceLocation = pgTable("resource_location", {
    resourceId: uuid("resource_id").notNull().references(() => resource.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").notNull().references(() => location.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.resourceId, table.locationId] })]);

export const resourceRelation = pgTable("resource_relation", {
    parentResourceId: uuid("parent_id").notNull().references((): AnyPgColumn => resource.id, { onDelete: "cascade" }),
    childResourceId: uuid("child_id").notNull().references((): AnyPgColumn => resource.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
}, (table) => [primaryKey({ columns: [table.parentResourceId, table.childResourceId] })]);

export type Location = typeof location.$inferSelect;
export type NewLocation = typeof location.$inferInsert;
export type Resource = typeof resource.$inferSelect;
export type NewResource = typeof resource.$inferInsert;
