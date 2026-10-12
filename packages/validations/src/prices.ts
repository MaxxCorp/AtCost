import * as v from 'valibot';
import type { Menu as DbMenu, MenuItem as DbMenuItem } from '@ac/db';
import type { Consumable } from './consumables.js';
import type { Recipe } from './recipes.js';
import type { Tag } from './tags.js';

export type PriceItem = Omit<DbMenuItem, 'createdAt' | 'updatedAt'> & {
    createdAt?: string;
    updatedAt?: string;
    consumable?: Consumable | null;
    recipe?: Recipe | null;
    tags?: Tag[];
};

export type PriceListItem = PriceItem;

export type Price = Omit<DbMenu, 'createdAt' | 'updatedAt'> & {
    createdAt: string;
    updatedAt: string;
    items?: PriceItem[];
    totalPricePerPortion?: number;
    totalCostPerPortion?: number;
    user?: {
        id: string;
        name: string | null;
        email: string;
    };
};

export type PriceList = Price;

export const pricePaginationSchema = v.optional(v.object({
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

export const priceListPaginationSchema = pricePaginationSchema;

export const priceItemInputSchema = v.object({
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

export const priceListItemInputSchema = priceItemInputSchema;

export const createPriceSchema = v.object({
    name: v.pipe(v.string(), v.minLength(1, 'Price list name is required')),
    description: v.optional(v.string()),
    isTemplate: v.optional(v.union([
        v.boolean(),
        v.pipe(v.string(), v.transform((val) => val === 'true'))
    ])),
    items: v.optional(v.union([v.string(), v.array(v.string())])),
});

export const createPriceListSchema = createPriceSchema;

export const updatePriceSchema = v.object({
    id: v.pipe(v.string(), v.minLength(1)),
    name: v.pipe(v.string(), v.minLength(1, 'Price list name is required')),
    description: v.optional(v.string()),
    isTemplate: v.optional(v.union([
        v.boolean(),
        v.pipe(v.string(), v.transform((val) => val === 'true'))
    ])),
    items: v.optional(v.union([v.string(), v.array(v.string())])),
});

export const updatePriceListSchema = updatePriceSchema;

export const priceAssociationSchema = v.object({
    type: v.picklist(['event']),
    entityId: v.string(),
    priceId: v.optional(v.pipe(v.string(), v.uuid())),
    priceListId: v.optional(v.pipe(v.string(), v.uuid())),
});

export const priceListAssociationSchema = priceAssociationSchema;

export const getPriceAssociationsSchema = v.object({
    type: v.picklist(['event']),
    entityId: v.string(),
});

export const getPriceListAssociationsSchema = getPriceAssociationsSchema;

export const removePriceItemSchema = v.object({
    priceId: v.pipe(v.string(), v.minLength(1)),
    itemId: v.pipe(v.string(), v.minLength(1)),
});

export const updatePriceItemSchema = v.object({
    priceId: v.pipe(v.string(), v.minLength(1)),
    item: priceItemInputSchema,
});

