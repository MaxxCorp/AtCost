import * as v from 'valibot';
import type { Menu as DbMenu, MenuItem as DbMenuItem } from '@ac/db';
import type { Consumable } from './consumables.js';
import type { Recipe } from './recipes.js';

export type MenuItem = Omit<DbMenuItem, 'createdAt' | 'updatedAt'> & {
    createdAt?: string;
    updatedAt?: string;
    consumable?: Consumable | null;
    recipe?: Recipe | null;
};

export type Menu = Omit<DbMenu, 'createdAt' | 'updatedAt'> & {
    createdAt: string;
    updatedAt: string;
    items?: MenuItem[];
    totalPricePerPortion?: number;
    totalCostPerPortion?: number;
    user?: {
        id: string;
        name: string | null;
        email: string;
    };
};

export const menuPaginationSchema = v.optional(v.object({
    page: v.optional(v.number(), 1),
    limit: v.optional(v.number(), 50),
    search: v.optional(v.string()),
    isTemplate: v.optional(v.union([v.boolean(), v.string()])),
    sortField: v.optional(v.union([
        v.literal('name'),
        v.literal('displayName'),
        v.literal('isTemplate'),
        v.literal('createdAt'),
        v.literal('updatedAt')
    ])),
    sortOrder: v.optional(v.union([v.literal('asc'), v.literal('desc')])),
}), {});

export const menuItemInputSchema = v.object({
    id: v.optional(v.string()),
    itemType: v.picklist(['consumable', 'recipe']),
    consumableId: v.optional(v.nullable(v.pipe(v.string(), v.uuid()))),
    recipeId: v.optional(v.nullable(v.pipe(v.string(), v.uuid()))),
    name: v.pipe(v.string(), v.minLength(1, 'Item name is required')),
    description: v.optional(v.nullable(v.string()), ''),
    portionAmount: v.pipe(
        v.union([v.number(), v.string()]),
        v.transform((val) => typeof val === 'number' ? val : parseFloat(String(val)) || 1)
    ),
    unit: v.optional(v.nullable(v.string()), null),
    costPrice: v.optional(v.pipe(
        v.union([v.number(), v.string()]),
        v.transform((val) => typeof val === 'number' ? val : parseFloat(String(val)) || 0)
    ), 0),
    factor: v.optional(v.pipe(
        v.union([v.number(), v.string()]),
        v.transform((val) => typeof val === 'number' ? val : parseFloat(String(val)) || 2)
    ), 2),
    unitPrice: v.pipe(
        v.union([v.number(), v.string()]),
        v.transform((val) => typeof val === 'number' ? val : parseFloat(String(val)) || 0)
    ),
    sortOrder: v.optional(v.pipe(
        v.union([v.number(), v.string()]),
        v.transform((val) => typeof val === 'number' ? val : parseInt(String(val), 10) || 0)
    ), 0),
});

export const createMenuSchema = v.object({
    name: v.pipe(v.string(), v.minLength(1, 'Menu name is required')),
    description: v.optional(v.string()),
    isTemplate: v.optional(v.union([
        v.boolean(),
        v.pipe(v.string(), v.transform((val) => val === 'true'))
    ])),
    items: v.optional(v.union([v.string(), v.array(v.string())])),
});

export const updateMenuSchema = v.object({
    id: v.pipe(v.string(), v.minLength(1)),
    name: v.pipe(v.string(), v.minLength(1, 'Menu name is required')),
    description: v.optional(v.string()),
    isTemplate: v.optional(v.union([
        v.boolean(),
        v.pipe(v.string(), v.transform((val) => val === 'true'))
    ])),
    items: v.optional(v.union([v.string(), v.array(v.string())])),
});

export const menuAssociationSchema = v.object({
    type: v.picklist(['event']),
    entityId: v.string(),
    menuId: v.pipe(v.string(), v.uuid()),
});

export const getMenuAssociationsSchema = v.object({
    type: v.picklist(['event']),
    entityId: v.string(),
});
