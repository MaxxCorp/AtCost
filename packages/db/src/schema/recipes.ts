import { pgTable, text, timestamp, uuid, doublePrecision, primaryKey } from "drizzle-orm/pg-core";
import { consumable } from "./consumables";

export const recipe = pgTable("recipe", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    instructions: text("instructions"), // instructions for preparation
    portions: doublePrecision("portions").default(1).notNull(), // yield in portions
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const recipeConsumable = pgTable("recipe_consumable", {
    recipeId: uuid("recipe_id").notNull().references(() => recipe.id, { onDelete: "cascade" }),
    consumableId: uuid("consumable_id").notNull().references(() => consumable.id, { onDelete: "cascade" }),
    amount: doublePrecision("amount").notNull(), // amount needed for the recipe portions
    unit: text("unit"), // unit override if applicable
}, (table) => [
    primaryKey({ columns: [table.recipeId, table.consumableId] })
]);

export type Recipe = typeof recipe.$inferSelect;
export type NewRecipe = typeof recipe.$inferInsert;
export type RecipeConsumable = typeof recipeConsumable.$inferSelect;
export type NewRecipeConsumable = typeof recipeConsumable.$inferInsert;
