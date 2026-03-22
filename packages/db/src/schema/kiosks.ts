import { pgTable, text, timestamp, uuid, integer, primaryKey } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { location } from "./resources";

// --- KIOSK TABLES ---

export const kiosk = pgTable("kiosk", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").default("offline").notNull(),
    rangeMode: text("range_mode", { enum: ["fixed", "relative", "rolling"] }).default("relative").notNull(),
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),
    lookAhead: integer("look_ahead").default(604800).notNull(), // 7 days in seconds
    lookPast: integer("look_past").default(86400).notNull(), // 1 day in seconds
    loopDuration: integer("loop_duration").default(30).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const kioskLocation = pgTable("kiosk_location", {
    kioskId: uuid("kiosk_id").notNull().references(() => kiosk.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").notNull().references(() => location.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.kioskId, table.locationId] })]);

export type Kiosk = typeof kiosk.$inferSelect;
export type NewKiosk = typeof kiosk.$inferInsert;
