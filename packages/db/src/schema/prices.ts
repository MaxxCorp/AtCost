import { pgTable, text, timestamp, uuid, doublePrecision, integer, boolean, primaryKey } from "drizzle-orm/pg-core";
import { consumable } from "./consumables";
import { recipe } from "./recipes";
import { event } from "./events";

export const price = pgTable("price", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    isTemplate: boolean("is_template").default(true).notNull(), // provides templates similar to kiosk templates
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

export type Price = typeof price.$inferSelect;
export type NewPrice = typeof price.$inferInsert;
export type PriceItem = typeof priceItem.$inferSelect;
export type NewPriceItem = typeof priceItem.$inferInsert;
export type EventPrice = typeof eventPrice.$inferSelect;
export type NewEventPrice = typeof eventPrice.$inferInsert;
