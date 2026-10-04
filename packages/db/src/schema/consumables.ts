import { pgTable, text, timestamp, uuid, doublePrecision } from "drizzle-orm/pg-core";

export const consumable = pgTable("consumable", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    purchasePrice: doublePrecision("purchase_price").default(0).notNull(),
    unit: text("unit").default("piece").notNull(), // e.g. "kg", "g", "l", "ml", "piece", "can", "bottle", "pack"
    amount: doublePrecision("amount").default(1).notNull(), // package size / quantity corresponding to purchasePrice
    storageLocation: text("storage_location"),
    expirationDate: timestamp("expiration_date"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Consumable = typeof consumable.$inferSelect;
export type NewConsumable = typeof consumable.$inferInsert;
