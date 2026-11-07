import * as v from 'valibot';
import type { Price as DbPrice, PriceItem as DbPriceItem } from '@ac/db';
import type { Consumable } from './consumables.js';
import type { Recipe } from './recipes.js';
import type { Tag } from './tags.js';

export type PriceItem = Omit<DbPriceItem, 'createdAt' | 'updatedAt'> & {
    priceId?: string;
    createdAt?: string;
    updatedAt?: string;
    consumable?: Consumable | null;
    recipe?: Recipe | null;
    tags?: Tag[];
    currency?: string | null;
};

export type PriceListItem = PriceItem;

export type Price = Omit<DbPrice, 'createdAt' | 'updatedAt'> & {
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
    currency: v.optional(v.nullable(v.string()), 'EUR'),
    sortOrder: v.optional(v.pipe(
        v.union([v.number(), v.string()]),
        v.transform((val) => typeof val === 'number' ? val : parseInt(String(val), 10) || 0)
    ), 0),
});

export const priceListItemInputSchema = priceItemInputSchema;

export const createPriceSchema = v.object({
    currency: v.optional(v.string(), 'EUR'),
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
    currency: v.optional(v.string(), 'EUR'),
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


// --- INVENTORY RETRIEVAL MODES ---

export const INVENTORY_RETRIEVAL_MODES = [
    'fifo',
    'fefo',
    'lifo',
    'lowest_cost',
    'highest_cost',
    'none'
] as const;

export type InventoryRetrievalMode = typeof INVENTORY_RETRIEVAL_MODES[number];

export const inventoryRetrievalModeSchema = v.picklist(INVENTORY_RETRIEVAL_MODES);

// --- SHOPPING LIST ---

export interface ShoppingListSourceUsage {
    priceListId: string;
    priceListName: string;
    priceItemId: string;
    priceItemName: string;
    itemType: 'consumable' | 'recipe';
    amountPerParticipant: number;
    totalAmountForEvent: number;
}

export interface ShoppingListBatchInfo {
    id: string;
    name: string;
    amount: number;
    unit: string;
    costPerUnit: number;
    currency: string;
    storageLocation: string | null;
    expirationDate: string | null;
    createdAt: string;
    isExpired: boolean;
}

export interface EventShoppingListItem {
    key: string;
    consumableId: string | null;
    name: string;
    unit: string;
    currency: string;
    requiredPerParticipant: number;
    requiredTotal: number;
    inStockValid: number;
    inStockExpired: number;
    inStockTotal: number;
    toBuyAmount: number;
    surplusAmount: number;
    unitCost: number;
    estimatedPurchaseCost: number;
    storageLocations: string[];
    usages: ShoppingListSourceUsage[];
    batches: ShoppingListBatchInfo[];
}

export interface EventShoppingListResult {
    eventId: string;
    eventSummary: string;
    participantsCount: number;
    currency: string;
    items: EventShoppingListItem[];
    totalRequiredItemsCount: number;
    itemsToBuyCount: number;
    itemsFullyStockedCount: number;
    totalEstimatedPurchaseCost: number;
}

export const getEventShoppingListSchema = v.object({
    eventId: v.pipe(v.string(), v.minLength(1)),
    participantsCount: v.optional(v.number()),
    excludeExpiredStock: v.optional(v.boolean(), true),
});

export const restockShoppingListItemInputSchema = v.object({
    consumableId: v.optional(v.nullable(v.string())),
    name: v.pipe(v.string(), v.minLength(1)),
    amount: v.pipe(v.number(), v.minValue(0.0001)),
    unit: v.string(),
    purchasePrice: v.pipe(v.number(), v.minValue(0)),
    currency: v.optional(v.string(), 'EUR'),
    storageLocation: v.optional(v.string()),
    expirationDate: v.optional(v.string()),
});

export const restockShoppingListItemsSchema = v.object({
    eventId: v.pipe(v.string(), v.minLength(1)),
    items: v.array(restockShoppingListItemInputSchema),
});

// --- EVENT SALES & FINANCIAL RESULT ---

export interface InventoryDeductionDetail {
    consumableId: string;
    consumableName: string;
    storageLocation?: string | null;
    deductedAmount: number;
    unit: string;
    unitCost: number;
    totalBatchCost: number;
    expirationDate?: string | null;
}

export interface EventSaleRecord {
    id: string;
    eventId: string;
    priceId: string | null;
    priceItemId: string | null;
    itemName: string;
    itemType: 'consumable' | 'recipe';
    quantity: number;
    unitPrice: number;
    costPrice: number;
    totalRevenue: number;
    totalCost: number;
    profit: number;
    currency: string;
    source: 'pos' | 'scan' | 'manual';
    retrievalMode: InventoryRetrievalMode;
    inventoryDeducted: boolean;
    deductionDetails: InventoryDeductionDetail[];
    notes: string | null;
    soldAt: string;
    createdBy: string | null;
    createdAt: string;
}

export interface EventItemSalesSummary {
    priceItemId: string;
    priceId: string;
    priceListName: string;
    name: string;
    description: string | null;
    itemType: 'consumable' | 'recipe';
    unit: string | null;
    portionAmount: number;
    unitPrice: number;
    baseCostPrice: number;
    currency: string;
    plannedQuantity: number;
    plannedRevenue: number;
    plannedCost: number;
    plannedProfit: number;
    soldQuantity: number;
    actualRevenue: number;
    actualCost: number;
    actualProfit: number;
    availablePortionsInStock: number;
}

export interface EventFinancialResult {
    eventId: string;
    eventSummary: string;
    participantsCount: number;
    currency: string;
    plannedTotalRevenue: number;
    plannedTotalCost: number;
    plannedTotalProfit: number;
    actualTotalRevenue: number;
    actualTotalCost: number;
    actualTotalProfit: number;
    actualMarginPercent: number;
    revenueAttainmentPercent: number;
    profitVariance: number;
    totalPortionsSold: number;
    totalTransactionsCount: number;
    itemSummaries: EventItemSalesSummary[];
    salesHistory: EventSaleRecord[];
}

export const getEventSalesSchema = v.object({
    eventId: v.pipe(v.string(), v.minLength(1)),
    participantsCount: v.optional(v.number()),
});

export const saleLineItemInputSchema = v.object({
    priceItemId: v.pipe(v.string(), v.minLength(1)),
    quantity: v.pipe(
        v.union([v.number(), v.string()]),
        v.transform((val) => typeof val === 'number' ? val : parseFloat(String(val)) || 0)
    ),
    unitPriceOverride: v.optional(v.number()),
});

export const recordEventSalesSchema = v.object({
    eventId: v.pipe(v.string(), v.minLength(1)),
    items: v.array(saleLineItemInputSchema),
    retrievalMode: v.optional(inventoryRetrievalModeSchema, 'fifo'),
    deductInventory: v.optional(v.boolean(), true),
    mode: v.optional(v.picklist(['append', 'replace']), 'append'),
    source: v.optional(v.picklist(['pos', 'scan', 'manual']), 'manual'),
    notes: v.optional(v.string()),
});

export const deleteEventSaleSchema = v.object({
    eventId: v.pipe(v.string(), v.minLength(1)),
    saleId: v.pipe(v.string(), v.minLength(1)),
    restoreInventory: v.optional(v.boolean(), true),
});

// --- GEMINI PRICE LIST TALLY SCANNER ---

export const scanPriceListTalliesSchema = v.object({
    eventId: v.optional(v.string()),
    imageBase64: v.pipe(v.string(), v.minLength(10)),
    mimeType: v.optional(v.string(), 'image/jpeg'),
});

export interface ScannedTallyItem {
    priceItemId: string;
    priceListName: string;
    itemName: string;
    unitPrice: number;
    currency: string;
    countedMarks: number;
    confidence: 'high' | 'medium' | 'low';
    markBreakdown: string;
}

export interface PriceListScanResult {
    detectedEventId: string | null;
    detectedEventTitle: string | null;
    matchedEventId: string;
    matchedEventSummary: string;
    items: ScannedTallyItem[];
    totalCountedItems: number;
    estimatedTotalRevenue: number;
    currency: string;
    rawNotes?: string;
}
