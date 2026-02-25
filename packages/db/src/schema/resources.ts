import { pgTable, text, timestamp, doublePrecision, primaryKey, index, jsonb, integer, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Locations table
 * Stores physical locations where resources can be found or events can take place.
 */
export const location = pgTable("location", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    street: text("street"),
    houseNumber: text("house_number"),
    addressSuffix: text("address_suffix"),
    zip: text("zip"),
    city: text("city"),
    state: text("state"),
    country: text("country"),
    roomId: text("room_id"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    what3words: text("what3words"),
    inclusivitySupport: text("inclusivity_support"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
}, (table) => [
    index("location_user_id_idx").on(table.userId),
]);

/**
 * Resources table
 * Stores bookable items like rooms, equipment, etc.
 */
export const resource = pgTable("resource", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
        .references(() => location.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    type: text("type").notNull(),
    allocationCalendars: jsonb("allocation_calendars").$type<Array<{ provider: string; calendarId: string }>>(),
    maxOccupancy: integer("max_occupancy"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
}, (table) => [
    index("resource_user_id_idx").on(table.userId),
    index("resource_location_id_idx").on(table.locationId),
]);

/**
 * Resource Relations table (Many-to-Many Hierarchy)
 */
export const resourceRelation = pgTable("resource_relation", {
    parentResourceId: uuid("parent_resource_id")
        .notNull()
        .references(() => resource.id, { onDelete: "cascade" }),
    childResourceId: uuid("child_resource_id")
        .notNull()
        .references(() => resource.id, { onDelete: "cascade" }),
}, (table) => [
    primaryKey({ columns: [table.parentResourceId, table.childResourceId] }),
    index("resource_relation_parent_idx").on(table.parentResourceId),
    index("resource_relation_child_idx").on(table.childResourceId),
]);
