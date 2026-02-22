import { pgTable, text, timestamp, integer, uuid, index } from "drizzle-orm/pg-core";
import { user } from "./auth";


export const kiosk = pgTable("kiosk", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    // Display Settings
    loopDuration: integer("loop_duration").default(5).notNull(), // Seconds per slide
    lookAhead: integer("look_ahead").default(2419200).notNull(), // Seconds (4 weeks default)
    lookPast: integer("look_past").default(0).notNull(), // Seconds (0 default)

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
}, (table) => [
    index("kiosk_user_id_idx").on(table.userId),
]);



export type Kiosk = typeof kiosk.$inferSelect;
export type CreateKioskInput = typeof kiosk.$inferInsert;
