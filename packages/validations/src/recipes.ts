import * as v from 'valibot';
import type { Recipe as DbRecipe } from '@ac/db';
import type { Consumable } from './consumables.js';

export interface RecipeIngredient {
    consumableId: string;
    amount: number;
    unit?: string | null;
    consumable?: Consumable | null;
    ingredientCost?: number;
}

export type Recipe = Omit<DbRecipe, 'createdAt' | 'updatedAt'> & {
    createdAt: string;
    updatedAt: string;
    consumables?: RecipeIngredient[];
    costPerPortion?: number;
    totalCost?: number;
    user?: {
        id: string;
        name: string | null;
        email: string;
    };
};

export const recipePaginationSchema = v.optional(v.object({
    page: v.optional(v.number(), 1),
    limit: v.optional(v.number(), 50),
    search: v.optional(v.string()),
    sortField: v.optional(v.union([
        v.literal('name'),
        v.literal('portions'),
        v.literal('createdAt'),
        v.literal('updatedAt')
    ])),
    sortOrder: v.optional(v.union([v.literal('asc'), v.literal('desc')])),
}), {});

export const recipeIngredientInputSchema = v.object({
    consumableId: v.pipe(v.string(), v.minLength(1)),
    amount: v.pipe(
        v.union([v.number(), v.string()]),
        v.transform((val) => typeof val === 'number' ? val : parseFloat(String(val)) || 1)
    ),
    unit: v.optional(v.nullable(v.string())),
});

export const createRecipeSchema = v.object({
    name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
    description: v.optional(v.string()),
    instructions: v.optional(v.string()),
    portions: v.pipe(
        v.union([v.number(), v.string()]),
        v.transform((val) => typeof val === 'number' ? val : parseFloat(String(val)) || 1)
    ),
    ingredients: v.optional(v.union([v.string(), v.array(v.string())])),
});

export const updateRecipeSchema = v.object({
    id: v.pipe(v.string(), v.minLength(1)),
    name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
    description: v.optional(v.string()),
    instructions: v.optional(v.string()),
    portions: v.pipe(
        v.union([v.number(), v.string()]),
        v.transform((val) => typeof val === 'number' ? val : parseFloat(String(val)) || 1)
    ),
    ingredients: v.optional(v.union([v.string(), v.array(v.string())])),
});
