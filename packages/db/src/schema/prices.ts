import { pgTable, text, timestamp, uuid, doublePrecision, integer, boolean, jsonb, primaryKey } from "drizzle-orm/pg-core";
import { consumable } from "./consumables";
import { recipe } from "./recipes";
import { event } from "./events";

export interface InventoryDeductionEntry {
    consumableId: string;
    consumableName: string;
    storageLocation?: string | null;
    deductedAmount: number;
    unit: string;
    unitCost: number;
    totalBatchCost: number;
    expirationDate?: string | null;
}

export const price = pgTable("price", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    isTemplate: boolean("is_template").default(true).notNull(), // provides templates similar to kiosk templates
    currency: text("currency").default("EUR"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const priceItem = pgTable("price_item", {
    id: uuid("id").primaryKey().defaultRandom(),
    priceId: uuid("price_id").notNull().references(() => price.id, { onDelete: "cascade" }),
    itemType: text("item_type", { enum: ["consumable", "recipe"] }).notNull(),
    consumableId: uuid("consumable_id").references(() => consumable.id, { onDelete: "set null" }),
    recipeId: uuid("recipe_id").references(() => recipe.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    portionAmount: doublePrecision("portion_amount").default(1).notNull(), // portion / amount needed per participant
    unit: text("unit"),
    costPrice: doublePrecision("cost_price").default(0).notNull(), // base cost price per portion
    factor: doublePrecision("factor").default(2).notNull(), // markup multiplier (default: 2)
    unitPrice: doublePrecision("unit_price").default(0).notNull(), // final unit price (costPrice * factor)
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const eventPrice = pgTable("event_price", {
    eventId: uuid("event_id").notNull().references(() => event.id, { onDelete: "cascade" }),
    priceId: uuid("price_id").notNull().references(() => price.id, { onDelete: "cascade" }),
}, (table) => [
    primaryKey({ columns: [table.eventId, table.priceId] })
]);

export const eventSale = pgTable("event_sale", {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull().references(() => event.id, { onDelete: "cascade" }),
    priceId: uuid("price_id").references(() => price.id, { onDelete: "set null" }),
    priceItemId: uuid("price_item_id").references(() => priceItem.id, { onDelete: "set null" }),
    itemName: text("item_name").notNull(),
    itemType: text("item_type", { enum: ["consumable", "recipe"] }).default("consumable").notNull(),
    quantity: doublePrecision("quantity").default(1).notNull(),
    unitPrice: doublePrecision("unit_price").default(0).notNull(),
    costPrice: doublePrecision("cost_price").default(0).notNull(),
    totalRevenue: doublePrecision("total_revenue").default(0).notNull(),
    totalCost: doublePrecision("total_cost").default(0).notNull(),
    currency: text("currency").default("EUR").notNull(),
    source: text("source", { enum: ["pos", "scan", "manual"] }).default("manual").notNull(),
    retrievalMode: text("retrieval_mode", { enum: ["fifo", "fefo", "lifo", "lowest_cost", "highest_cost", "none"] }).default("fifo").notNull(),
    inventoryDeducted: boolean("inventory_deducted").default(false).notNull(),
    deductionDetails: jsonb("deduction_details").$type<InventoryDeductionEntry[]>().default([]).notNull(),
    notes: text("notes"),
    soldAt: timestamp("sold_at").defaultNow().notNull(),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Price = typeof price.$inferSelect;
export type NewPrice = typeof price.$inferInsert;
export type PriceItem = typeof priceItem.$inferSelect;
export type NewPriceItem = typeof priceItem.$inferInsert;
export type EventPrice = typeof eventPrice.$inferSelect;
export type NewEventPrice = typeof eventPrice.$inferInsert;
export type EventSale = typeof eventSale.$inferSelect;
export type NewEventSale = typeof eventSale.$inferInsert;
