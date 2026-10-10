import { pgTable, text, timestamp, uuid, doublePrecision, integer, boolean, primaryKey } from "drizzle-orm/pg-core";
import { consumable } from "./consumables";
import { recipe } from "./recipes";
import { event } from "./events";

export const menu = pgTable("menu", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    isTemplate: boolean("is_template").default(true).notNull(), // provides templates similar to kiosk templates
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const menuItem = pgTable("menu_item", {
    id: uuid("id").primaryKey().defaultRandom(),
    menuId: uuid("menu_id").notNull().references(() => menu.id, { onDelete: "cascade" }),
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

export const eventMenu = pgTable("event_menu", {
    eventId: uuid("event_id").notNull().references(() => event.id, { onDelete: "cascade" }),
    menuId: uuid("menu_id").notNull().references(() => menu.id, { onDelete: "cascade" }),
}, (table) => [
    primaryKey({ columns: [table.eventId, table.menuId] })
]);

export type Menu = typeof menu.$inferSelect;
export type NewMenu = typeof menu.$inferInsert;
export type MenuItem = typeof menuItem.$inferSelect;
export type NewMenuItem = typeof menuItem.$inferInsert;
export type EventMenu = typeof eventMenu.$inferSelect;
export type NewEventMenu = typeof eventMenu.$inferInsert;
