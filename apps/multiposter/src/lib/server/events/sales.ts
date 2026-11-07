import { db, event, eventPrice, eventSale, consumable, eq, desc, inArray, sql } from '@ac/db';
import type {
    EventShoppingListItem,
    EventShoppingListResult,
    EventFinancialResult,
    EventItemSalesSummary,
    EventSaleRecord,
    InventoryDeductionDetail,
    InventoryRetrievalMode,
    PriceListScanResult,
    ScannedTallyItem,
} from '@ac/validations';
import { resolveEventIdForAssociations } from './exceptions.js';
import { invalidateEvent } from '../cache/index.js';

let _saleTableEnsured = false;

export async function ensureEventSaleTable(): Promise<void> {
    if (_saleTableEnsured) return;
    try {
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "event_sale" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
                "event_id" uuid NOT NULL REFERENCES "public"."event"("id") ON DELETE cascade,
                "price_id" uuid REFERENCES "public"."price"("id") ON DELETE set null,
                "price_item_id" uuid REFERENCES "public"."price_item"("id") ON DELETE set null,
                "item_name" text NOT NULL,
                "item_type" text DEFAULT 'consumable' NOT NULL,
                "quantity" double precision DEFAULT 1 NOT NULL,
                "unit_price" double precision DEFAULT 0 NOT NULL,
                "cost_price" double precision DEFAULT 0 NOT NULL,
                "total_revenue" double precision DEFAULT 0 NOT NULL,
                "total_cost" double precision DEFAULT 0 NOT NULL,
                "currency" text DEFAULT 'EUR' NOT NULL,
                "source" text DEFAULT 'manual' NOT NULL,
                "retrieval_mode" text DEFAULT 'fifo' NOT NULL,
                "inventory_deducted" boolean DEFAULT false NOT NULL,
                "deduction_details" jsonb DEFAULT '[]'::jsonb NOT NULL,
                "notes" text,
                "sold_at" timestamp DEFAULT now() NOT NULL,
                "created_by" text,
                "created_at" timestamp DEFAULT now() NOT NULL,
                "updated_at" timestamp DEFAULT now() NOT NULL
            );
        `);
        _saleTableEnsured = true;
    } catch (err) {
        console.warn('Could not auto-ensure event_sale table:', err);
    }
}

function round2(n: number): number {
    return Math.round((Number(n) || 0) * 100) / 100;
}

function round4(n: number): number {
    return Math.round((Number(n) || 0) * 10000) / 10000;
}

function normStr(s: string | null | undefined): string {
    return (s || '').trim().toLowerCase();
}

function getBatchUnitCost(batch: { amount: number; purchasePrice: number }): number {
    const amt = Number(batch.amount) || 0;
    const price = Number(batch.purchasePrice) || 0;
    return amt > 0 ? price / amt : price;
}

export async function loadEventWithPrices(rawEventId: string) {
    let targetEventId = rawEventId;
    if (rawEventId.includes('_inst_')) {
        targetEventId = await resolveEventIdForAssociations(rawEventId, { materializeIfVirtual: false });
    }

    const evt = await db.query.event.findFirst({
        where: eq(event.id, targetEventId),
        with: {
            contacts: true,
            prices: {
                with: {
                    price: {
                        with: {
                            items: {
                                with: {
                                    consumable: {
                                        with: {
                                            tags: { with: { tag: { with: { category: true } } } }
                                        }
                                    },
                                    recipe: {
                                        with: {
                                            tags: { with: { tag: { with: { category: true } } } },
                                            consumables: {
                                                with: {
                                                    consumable: true
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    return { evt, targetEventId };
}

function findMatchingConsumableBatches(
    allConsumables: any[],
    targetConsumableId: string | null | undefined,
    targetName: string,
    targetUnit: string
) {
    const nName = normStr(targetName);
    const nUnit = normStr(targetUnit);

    return allConsumables.filter((c) => {
        if (targetConsumableId && c.id === targetConsumableId) return true;
        if (nName && normStr(c.name) === nName) {
            if (!nUnit || !c.unit || normStr(c.unit) === nUnit) {
                return true;
            }
        }
        return false;
    });
}

export async function computeEventShoppingList(params: {
    eventId: string;
    participantsCount?: number;
    excludeExpiredStock?: boolean;
}): Promise<EventShoppingListResult> {
    const { evt, targetEventId } = await loadEventWithPrices(params.eventId);
    if (!evt) {
        throw new Error('Event not found');
    }

    const participants = params.participantsCount !== undefined && params.participantsCount !== null
        ? Math.max(0, Number(params.participantsCount))
        : Math.max(1, Number(evt.participantsCount) || (evt.contacts?.length ?? 0) || 1);

    const excludeExpired = params.excludeExpiredStock ?? true;
    const eventCurrency = evt.currency || 'EUR';

    const allConsumables = await db.query.consumable.findMany({
        orderBy: (table, { asc }) => [asc(table.createdAt)]
    });

    const now = Date.now();

    interface AggregatedRequirement {
        key: string;
        consumableId: string | null;
        name: string;
        unit: string;
        currency: string;
        fallbackUnitCost: number;
        requiredPerParticipant: number;
        requiredTotal: number;
        usages: EventShoppingListItem['usages'];
    }

    const reqMap = new Map<string, AggregatedRequirement>();

    for (const ep of evt.prices || []) {
        const priceList = (ep as any).price;
        if (!priceList) continue;

        for (const item of priceList.items || []) {
            const itemPortionAmount = Number(item.portionAmount) || 1;

            if (item.itemType === 'recipe' && item.recipe) {
                const recipePortions = Math.max(0.0001, Number(item.recipe.portions) || 1);
                const recipeIngredients = item.recipe.consumables || [];

                if (recipeIngredients.length > 0) {
                    for (const rc of recipeIngredients) {
                        const ingConsumable = rc.consumable;
                        const ingName = ingConsumable?.name || item.name;
                        const ingUnit = rc.unit || ingConsumable?.unit || item.unit || 'piece';
                        const ingId = rc.consumableId || ingConsumable?.id || null;
                        const key = `${normStr(ingName)}__${normStr(ingUnit)}`;

                        const amountPerParticipant = ((Number(rc.amount) || 0) / recipePortions) * itemPortionAmount;
                        const totalAmountForEvent = amountPerParticipant * participants;
                        const fallbackUnitCost = ingConsumable
                            ? getBatchUnitCost(ingConsumable)
                            : 0;

                        const existing = reqMap.get(key);
                        if (existing) {
                            existing.requiredPerParticipant = round4(existing.requiredPerParticipant + amountPerParticipant);
                            existing.requiredTotal = round4(existing.requiredTotal + totalAmountForEvent);
                            if (!existing.consumableId && ingId) existing.consumableId = ingId;
                            existing.usages.push({
                                priceListId: priceList.id,
                                priceListName: priceList.name,
                                priceItemId: item.id,
                                priceItemName: `${item.name} (${ingName})`,
                                itemType: 'recipe',
                                amountPerParticipant: round4(amountPerParticipant),
                                totalAmountForEvent: round4(totalAmountForEvent),
                            });
                        } else {
                            reqMap.set(key, {
                                key,
                                consumableId: ingId,
                                name: ingName,
                                unit: ingUnit,
                                currency: ingConsumable?.currency || priceList.currency || eventCurrency,
                                fallbackUnitCost,
                                requiredPerParticipant: round4(amountPerParticipant),
                                requiredTotal: round4(totalAmountForEvent),
                                usages: [{
                                    priceListId: priceList.id,
                                    priceListName: priceList.name,
                                    priceItemId: item.id,
                                    priceItemName: `${item.name} (${ingName})`,
                                    itemType: 'recipe',
                                    amountPerParticipant: round4(amountPerParticipant),
                                    totalAmountForEvent: round4(totalAmountForEvent),
                                }],
                            });
                        }
                    }
                    continue;
                }
            }

            // Direct consumable item (or recipe without linked ingredients)
            const c = item.consumable;
            const cName = c?.name || item.name;
            const cUnit = item.unit || c?.unit || 'piece';
            const cId = item.consumableId || c?.id || null;
            const key = `${normStr(cName)}__${normStr(cUnit)}`;

            const amountPerParticipant = itemPortionAmount;
            const totalAmountForEvent = amountPerParticipant * participants;
            const fallbackUnitCost = c
                ? getBatchUnitCost(c)
                : (Number(item.costPrice) || 0);

            const existing = reqMap.get(key);
            if (existing) {
                existing.requiredPerParticipant = round4(existing.requiredPerParticipant + amountPerParticipant);
                existing.requiredTotal = round4(existing.requiredTotal + totalAmountForEvent);
                if (!existing.consumableId && cId) existing.consumableId = cId;
                existing.usages.push({
                    priceListId: priceList.id,
                    priceListName: priceList.name,
                    priceItemId: item.id,
                    priceItemName: item.name,
                    itemType: item.itemType === 'recipe' ? 'recipe' : 'consumable',
                    amountPerParticipant: round4(amountPerParticipant),
                    totalAmountForEvent: round4(totalAmountForEvent),
                });
            } else {
                reqMap.set(key, {
                    key,
                    consumableId: cId,
                    name: cName,
                    unit: cUnit,
                    currency: c?.currency || priceList.currency || eventCurrency,
                    fallbackUnitCost,
                    requiredPerParticipant: round4(amountPerParticipant),
                    requiredTotal: round4(totalAmountForEvent),
                    usages: [{
                        priceListId: priceList.id,
                        priceListName: priceList.name,
                        priceItemId: item.id,
                        priceItemName: item.name,
                        itemType: item.itemType === 'recipe' ? 'recipe' : 'consumable',
                        amountPerParticipant: round4(amountPerParticipant),
                        totalAmountForEvent: round4(totalAmountForEvent),
                    }],
                });
            }
        }
    }

    const items: EventShoppingListItem[] = [];
    let totalEstimatedPurchaseCost = 0;
    let itemsToBuyCount = 0;
    let itemsFullyStockedCount = 0;

    for (const req of reqMap.values()) {
        const candidateBatches = findMatchingConsumableBatches(
            allConsumables,
            req.consumableId,
            req.name,
            req.unit
        );

        let inStockValid = 0;
        let inStockExpired = 0;
        const storageSet = new Set<string>();
        const batches: EventShoppingListItem['batches'] = [];

        for (const b of candidateBatches) {
            const amt = Math.max(0, Number(b.amount) || 0);
            const expTime = b.expirationDate ? new Date(b.expirationDate).getTime() : null;
            const isExpired = expTime !== null && !isNaN(expTime) && expTime < now;

            if (isExpired) {
                inStockExpired += amt;
            } else {
                inStockValid += amt;
            }

            if (b.storageLocation && b.storageLocation.trim()) {
                storageSet.add(b.storageLocation.trim());
            }

            batches.push({
                id: b.id,
                name: b.name,
                amount: round4(amt),
                unit: b.unit || req.unit,
                costPerUnit: round4(getBatchUnitCost(b)),
                currency: b.currency || req.currency,
                storageLocation: b.storageLocation || null,
                expirationDate: b.expirationDate ? new Date(b.expirationDate).toISOString() : null,
                createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : new Date().toISOString(),
                isExpired,
            });
        }

        const inStockTotal = round4(inStockValid + inStockExpired);
        const usableStock = excludeExpired ? inStockValid : inStockTotal;
        const toBuyAmount = Math.max(0, round4(req.requiredTotal - usableStock));
        const surplusAmount = Math.max(0, round4(usableStock - req.requiredTotal));

        const primaryBatchCost = batches.find((b) => b.costPerUnit > 0)?.costPerUnit;
        const unitCost = round4(primaryBatchCost ?? req.fallbackUnitCost ?? 0);
        const estimatedPurchaseCost = round2(toBuyAmount * unitCost);

        if (toBuyAmount > 0) {
            itemsToBuyCount++;
            totalEstimatedPurchaseCost += estimatedPurchaseCost;
        } else {
            itemsFullyStockedCount++;
        }

        items.push({
            key: req.key,
            consumableId: req.consumableId,
            name: req.name,
            unit: req.unit,
            currency: req.currency,
            requiredPerParticipant: req.requiredPerParticipant,
            requiredTotal: req.requiredTotal,
            inStockValid: round4(inStockValid),
            inStockExpired: round4(inStockExpired),
            inStockTotal,
            toBuyAmount,
            surplusAmount,
            unitCost,
            estimatedPurchaseCost,
            storageLocations: Array.from(storageSet),
            usages: req.usages,
            batches,
        });
    }

    items.sort((a, b) => {
        if ((a.toBuyAmount > 0) !== (b.toBuyAmount > 0)) {
            return a.toBuyAmount > 0 ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });

    return {
        eventId: targetEventId,
        eventSummary: evt.summary,
        participantsCount: participants,
        currency: eventCurrency,
        items,
        totalRequiredItemsCount: items.length,
        itemsToBuyCount,
        itemsFullyStockedCount,
        totalEstimatedPurchaseCost: round2(totalEstimatedPurchaseCost),
    };
}

export function sortBatchesByRetrievalMode(
    batches: any[],
    mode: InventoryRetrievalMode,
    preferredConsumableId?: string | null
): any[] {
    const now = Date.now();
    const activeBatches = batches.filter((b) => (Number(b.amount) || 0) > 0);

    return [...activeBatches].sort((a, b) => {
        if (mode === 'fefo') {
            const expA = a.expirationDate ? new Date(a.expirationDate).getTime() : Infinity;
            const expB = b.expirationDate ? new Date(b.expirationDate).getTime() : Infinity;
            // Non-expired with earliest expiration first; put already expired at the end
            const validExpA = expA < now ? Infinity : expA;
            const validExpB = expB < now ? Infinity : expB;
            if (validExpA !== validExpB) return validExpA - validExpB;
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (mode === 'lifo') {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (mode === 'lowest_cost') {
            return getBatchUnitCost(a) - getBatchUnitCost(b);
        }
        if (mode === 'highest_cost') {
            return getBatchUnitCost(b) - getBatchUnitCost(a);
        }
        // Default: 'fifo' (oldest createdAt first)
        const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (timeDiff !== 0) return timeDiff;
        if (preferredConsumableId) {
            if (a.id === preferredConsumableId) return -1;
            if (b.id === preferredConsumableId) return 1;
        }
        return 0;
    });
}

function computeAvailablePortionsForPriceItem(item: any, allConsumables: any[]): number {
    const portionAmount = Math.max(0.0001, Number(item.portionAmount) || 1);

    if (item.itemType === 'recipe' && item.recipe && (item.recipe.consumables?.length ?? 0) > 0) {
        const recipePortions = Math.max(0.0001, Number(item.recipe.portions) || 1);
        let minPortions = Infinity;

        for (const rc of item.recipe.consumables) {
            const ingConsumable = rc.consumable;
            const ingName = ingConsumable?.name || '';
            const ingUnit = rc.unit || ingConsumable?.unit || '';
            const neededPerItemSale = ((Number(rc.amount) || 0) / recipePortions) * portionAmount;
            if (neededPerItemSale <= 0) continue;

            const matching = findMatchingConsumableBatches(
                allConsumables,
                rc.consumableId,
                ingName,
                ingUnit
            );
            const totalStock = matching.reduce((sum, b) => sum + Math.max(0, Number(b.amount) || 0), 0);
            const possiblePortions = Math.floor((totalStock + 1e-6) / neededPerItemSale);
            if (possiblePortions < minPortions) {
                minPortions = possiblePortions;
            }
        }
        return minPortions === Infinity ? 0 : Math.max(0, minPortions);
    }

    const c = item.consumable;
    const cName = c?.name || item.name;
    const cUnit = item.unit || c?.unit || '';
    const matching = findMatchingConsumableBatches(
        allConsumables,
        item.consumableId,
        cName,
        cUnit
    );
    const totalStock = matching.reduce((sum, b) => sum + Math.max(0, Number(b.amount) || 0), 0);
    return Math.max(0, Math.floor((totalStock + 1e-6) / portionAmount));
}

export async function getEventSalesAndFinancials(params: {
    eventId: string;
    participantsCount?: number;
}): Promise<EventFinancialResult> {
    await ensureEventSaleTable();
    const { evt, targetEventId } = await loadEventWithPrices(params.eventId);
    if (!evt) {
        throw new Error('Event not found');
    }

    const participants = params.participantsCount !== undefined && params.participantsCount !== null
        ? Math.max(0, Number(params.participantsCount))
        : Math.max(1, Number(evt.participantsCount) || (evt.contacts?.length ?? 0) || 1);

    const eventCurrency = evt.currency || 'EUR';

    const [allConsumables, rawSales] = await Promise.all([
        db.query.consumable.findMany(),
        db.select().from(eventSale).where(eq(eventSale.eventId, targetEventId)).orderBy(desc(eventSale.soldAt), desc(eventSale.createdAt))
    ]);

    const salesHistory: EventSaleRecord[] = rawSales.map((s) => ({
        id: s.id,
        eventId: s.eventId,
        priceId: s.priceId,
        priceItemId: s.priceItemId,
        itemName: s.itemName,
        itemType: (s.itemType === 'recipe' ? 'recipe' : 'consumable') as 'consumable' | 'recipe',
        quantity: Number(s.quantity) || 0,
        unitPrice: Number(s.unitPrice) || 0,
        costPrice: Number(s.costPrice) || 0,
        totalRevenue: round2(Number(s.totalRevenue) || 0),
        totalCost: round2(Number(s.totalCost) || 0),
        profit: round2((Number(s.totalRevenue) || 0) - (Number(s.totalCost) || 0)),
        currency: s.currency || eventCurrency,
        source: (s.source as any) || 'manual',
        retrievalMode: (s.retrievalMode as InventoryRetrievalMode) || 'fifo',
        inventoryDeducted: Boolean(s.inventoryDeducted),
        deductionDetails: Array.isArray(s.deductionDetails) ? s.deductionDetails : [],
        notes: s.notes || null,
        soldAt: s.soldAt ? new Date(s.soldAt).toISOString() : new Date().toISOString(),
        createdBy: s.createdBy || null,
        createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
    }));

    const salesByItemId = new Map<string, { quantity: number; revenue: number; cost: number }>();
    for (const sale of salesHistory) {
        if (!sale.priceItemId) continue;
        const cur = salesByItemId.get(sale.priceItemId) || { quantity: 0, revenue: 0, cost: 0 };
        cur.quantity = round4(cur.quantity + sale.quantity);
        cur.revenue = round2(cur.revenue + sale.totalRevenue);
        cur.cost = round2(cur.cost + sale.totalCost);
        salesByItemId.set(sale.priceItemId, cur);
    }

    const itemSummaries: EventItemSalesSummary[] = [];
    let plannedTotalRevenue = 0;
    let plannedTotalCost = 0;

    for (const ep of evt.prices || []) {
        const priceList = (ep as any).price;
        if (!priceList) continue;

        for (const item of priceList.items || []) {
            const portionAmount = Number(item.portionAmount) || 1;
            const unitPrice = Number(item.unitPrice) || 0;
            const baseCostPrice = Number(item.costPrice) || 0;

            const plannedQuantity = round4(participants * portionAmount);
            const plannedRevenue = round2(participants * unitPrice * portionAmount);
            const plannedCost = round2(participants * baseCostPrice * portionAmount);
            const plannedProfit = round2(plannedRevenue - plannedCost);

            plannedTotalRevenue += plannedRevenue;
            plannedTotalCost += plannedCost;

            const itemSales = salesByItemId.get(item.id) || { quantity: 0, revenue: 0, cost: 0 };
            const availablePortionsInStock = computeAvailablePortionsForPriceItem(item, allConsumables);

            itemSummaries.push({
                priceItemId: item.id,
                priceId: priceList.id,
                priceListName: priceList.name,
                name: item.name,
                description: item.description || null,
                itemType: item.itemType === 'recipe' ? 'recipe' : 'consumable',
                unit: item.unit || item.consumable?.unit || 'portion',
                portionAmount,
                unitPrice,
                baseCostPrice,
                currency: priceList.currency || eventCurrency,
                plannedQuantity,
                plannedRevenue,
                plannedCost,
                plannedProfit,
                soldQuantity: itemSales.quantity,
                actualRevenue: itemSales.revenue,
                actualCost: itemSales.cost,
                actualProfit: round2(itemSales.revenue - itemSales.cost),
                availablePortionsInStock,
            });
        }
    }

    const actualTotalRevenue = round2(salesHistory.reduce((sum, s) => sum + s.totalRevenue, 0));
    const actualTotalCost = round2(salesHistory.reduce((sum, s) => sum + s.totalCost, 0));
    const actualTotalProfit = round2(actualTotalRevenue - actualTotalCost);
    const plannedTotalProfit = round2(plannedTotalRevenue - plannedTotalCost);
    const totalPortionsSold = round4(salesHistory.reduce((sum, s) => sum + s.quantity, 0));

    const actualMarginPercent = actualTotalRevenue > 0
        ? round2((actualTotalProfit / actualTotalRevenue) * 100)
        : 0;
    const revenueAttainmentPercent = plannedTotalRevenue > 0
        ? round2((actualTotalRevenue / plannedTotalRevenue) * 100)
        : 0;
    const profitVariance = round2(actualTotalProfit - plannedTotalProfit);

    return {
        eventId: targetEventId,
        eventSummary: evt.summary,
        participantsCount: participants,
        currency: eventCurrency,
        plannedTotalRevenue: round2(plannedTotalRevenue),
        plannedTotalCost: round2(plannedTotalCost),
        plannedTotalProfit,
        actualTotalRevenue,
        actualTotalCost,
        actualTotalProfit,
        actualMarginPercent,
        revenueAttainmentPercent,
        profitVariance,
        totalPortionsSold,
        totalTransactionsCount: salesHistory.length,
        itemSummaries,
        salesHistory,
    };
}

async function restoreInventoryFromSale(sale: {
    inventoryDeducted: boolean;
    deductionDetails: InventoryDeductionDetail[] | any;
}) {
    if (!sale.inventoryDeducted || !Array.isArray(sale.deductionDetails)) return;
    for (const d of sale.deductionDetails as InventoryDeductionDetail[]) {
        if (!d.consumableId || !(d.deductedAmount > 0)) continue;
        const batch = await db.query.consumable.findFirst({
            where: eq(consumable.id, d.consumableId)
        });
        if (!batch) continue;
        const unitCost = d.unitCost > 0 ? d.unitCost : getBatchUnitCost(batch);
        const restoredAmount = round4((Number(batch.amount) || 0) + Number(d.deductedAmount));
        const restoredPurchasePrice = round4(restoredAmount * unitCost);
        await db.update(consumable)
            .set({
                amount: restoredAmount,
                purchasePrice: restoredPurchasePrice,
                updatedAt: new Date(),
            })
            .where(eq(consumable.id, batch.id));
    }
}

export async function recordEventSales(params: {
    eventId: string;
    items: { priceItemId: string; quantity: number; unitPriceOverride?: number }[];
    retrievalMode?: InventoryRetrievalMode;
    deductInventory?: boolean;
    mode?: 'append' | 'replace';
    source?: 'pos' | 'scan' | 'manual';
    notes?: string;
    userId?: string | null;
}) {
    await ensureEventSaleTable();
    const { evt, targetEventId } = await loadEventWithPrices(params.eventId);
    if (!evt) {
        throw new Error('Event not found');
    }

    const retrievalMode: InventoryRetrievalMode = params.retrievalMode || 'fifo';
    const shouldDeduct = (params.deductInventory ?? true) && retrievalMode !== 'none';
    const mode = params.mode || 'append';
    const source = params.source || 'manual';
    const eventCurrency = evt.currency || 'EUR';

    // Build lookup map of price items associated with this event
    const itemMap = new Map<string, { item: any; priceList: any }>();
    for (const ep of evt.prices || []) {
        const priceList = (ep as any).price;
        if (!priceList) continue;
        for (const it of priceList.items || []) {
            itemMap.set(it.id, { item: it, priceList });
        }
    }

    // If mode === 'replace', remove existing sales for the submitted priceItemIds (and restore their deducted inventory first)
    if (mode === 'replace') {
        const targetItemIds = params.items.map((i) => i.priceItemId).filter(Boolean);
        if (targetItemIds.length > 0) {
            const existingSales = await db.select()
                .from(eventSale)
                .where(eq(eventSale.eventId, targetEventId));
            const toReplace = existingSales.filter((s) => s.priceItemId && targetItemIds.includes(s.priceItemId));
            for (const oldSale of toReplace) {
                await restoreInventoryFromSale(oldSale);
            }
            if (toReplace.length > 0) {
                await db.delete(eventSale).where(
                    inArray(eventSale.id, toReplace.map((s) => s.id))
                );
            }
        }
    }

    const allConsumables = await db.query.consumable.findMany();
    const createdSales: any[] = [];

    for (const line of params.items) {
        const qty = Number(line.quantity) || 0;
        if (qty <= 0) continue;

        const match = itemMap.get(line.priceItemId);
        if (!match) continue;

        const { item, priceList } = match;
        const portionAmount = Number(item.portionAmount) || 1;
        const unitPrice = line.unitPriceOverride !== undefined
            ? Number(line.unitPriceOverride)
            : (Number(item.unitPrice) || 0) * portionAmount;
        const fallbackPortionCost = (Number(item.costPrice) || 0) * portionAmount;

        const totalRevenue = round2(qty * unitPrice);
        const deductionDetails: InventoryDeductionDetail[] = [];
        let calculatedTotalCost = 0;

        if (shouldDeduct) {
            // Determine consumable requirements for `qty` sales of `item`
            const requirements: {
                consumableId: string | null;
                name: string;
                unit: string;
                neededAmount: number;
                fallbackUnitCost: number;
            }[] = [];

            if (item.itemType === 'recipe' && item.recipe && (item.recipe.consumables?.length ?? 0) > 0) {
                const recipePortions = Math.max(0.0001, Number(item.recipe.portions) || 1);
                for (const rc of item.recipe.consumables) {
                    const ing = rc.consumable;
                    const neededAmount = ((Number(rc.amount) || 0) / recipePortions) * portionAmount * qty;
                    if (neededAmount > 0) {
                        requirements.push({
                            consumableId: rc.consumableId || ing?.id || null,
                            name: ing?.name || item.name,
                            unit: rc.unit || ing?.unit || 'piece',
                            neededAmount,
                            fallbackUnitCost: ing ? getBatchUnitCost(ing) : 0,
                        });
                    }
                }
            } else {
                const c = item.consumable;
                requirements.push({
                    consumableId: item.consumableId || c?.id || null,
                    name: c?.name || item.name,
                    unit: item.unit || c?.unit || 'piece',
                    neededAmount: portionAmount * qty,
                    fallbackUnitCost: c ? getBatchUnitCost(c) : (Number(item.costPrice) || 0),
                });
            }

            for (const req of requirements) {
                const candidates = findMatchingConsumableBatches(
                    allConsumables,
                    req.consumableId,
                    req.name,
                    req.unit
                );
                const sortedBatches = sortBatchesByRetrievalMode(
                    candidates,
                    retrievalMode,
                    req.consumableId
                );

                let remainingToDeduct = req.neededAmount;

                for (const batch of sortedBatches) {
                    if (remainingToDeduct <= 1e-6) break;
                    const available = Math.max(0, Number(batch.amount) || 0);
                    if (available <= 0) continue;

                    const take = round4(Math.min(available, remainingToDeduct));
                    const batchUnitCost = getBatchUnitCost(batch);
                    const batchCost = round4(take * batchUnitCost);

                    const newAmount = Math.max(0, round4(available - take));
                    // Preserve unit cost when amount reaches 0 so `amount > 0 ? purchasePrice / amount : purchasePrice` retains unit cost
                    const newPurchasePrice = newAmount > 0
                        ? round4(newAmount * batchUnitCost)
                        : round4(batchUnitCost);

                    batch.amount = newAmount;
                    batch.purchasePrice = newPurchasePrice;

                    await db.update(consumable)
                        .set({
                            amount: newAmount,
                            purchasePrice: newPurchasePrice,
                            updatedAt: new Date(),
                        })
                        .where(eq(consumable.id, batch.id));

                    deductionDetails.push({
                        consumableId: batch.id,
                        consumableName: batch.name,
                        storageLocation: batch.storageLocation || null,
                        deductedAmount: take,
                        unit: batch.unit || req.unit,
                        unitCost: round4(batchUnitCost),
                        totalBatchCost: round2(batchCost),
                        expirationDate: batch.expirationDate ? new Date(batch.expirationDate).toISOString() : null,
                    });

                    calculatedTotalCost += batchCost;
                    remainingToDeduct = round4(remainingToDeduct - take);
                }

                // If stock was insufficient for the full sale, value the remaining unstocked portion at fallbackUnitCost
                if (remainingToDeduct > 1e-6) {
                    calculatedTotalCost += remainingToDeduct * req.fallbackUnitCost;
                }
            }
        } else {
            calculatedTotalCost = qty * fallbackPortionCost;
        }

        const totalCost = round2(calculatedTotalCost);
        const unitCostSnapshot = qty > 0 ? round4(totalCost / qty) : fallbackPortionCost;

        const [inserted] = await db.insert(eventSale).values({
            eventId: targetEventId,
            priceId: priceList.id,
            priceItemId: item.id,
            itemName: item.name,
            itemType: item.itemType === 'recipe' ? 'recipe' : 'consumable',
            quantity: qty,
            unitPrice: round2(unitPrice),
            costPrice: unitCostSnapshot,
            totalRevenue,
            totalCost,
            currency: priceList.currency || eventCurrency,
            source,
            retrievalMode,
            inventoryDeducted: shouldDeduct && deductionDetails.length > 0,
            deductionDetails,
            notes: params.notes || null,
            createdBy: params.userId || null,
        }).returning();

        createdSales.push(inserted);
    }

    await invalidateEvent(targetEventId);
    const financials = await getEventSalesAndFinancials({ eventId: targetEventId });

    return {
        success: true,
        createdSalesCount: createdSales.length,
        financials,
    };
}

export async function removeEventSaleRecord(params: {
    eventId: string;
    saleId: string;
    restoreInventory?: boolean;
}) {
    await ensureEventSaleTable();
    const { targetEventId } = await loadEventWithPrices(params.eventId);

    const [sale] = await db.select().from(eventSale).where(eq(eventSale.id, params.saleId));
    if (!sale) {
        throw new Error('Sale record not found');
    }

    if (params.restoreInventory ?? true) {
        await restoreInventoryFromSale(sale);
    }

    await db.delete(eventSale).where(eq(eventSale.id, params.saleId));
    await invalidateEvent(targetEventId);

    const financials = await getEventSalesAndFinancials({ eventId: targetEventId });
    return {
        success: true,
        financials,
    };
}

export async function restockShoppingListItems(params: {
    eventId: string;
    items: {
        consumableId?: string | null;
        name: string;
        amount: number;
        unit: string;
        purchasePrice: number;
        currency?: string;
        storageLocation?: string;
        expirationDate?: string;
    }[];
    userId: string;
}) {
    const insertedIds: string[] = [];
    for (const item of params.items) {
        if (!item.name || !(item.amount > 0)) continue;
        const [created] = await db.insert(consumable).values({
            userId: params.userId,
            name: item.name.trim(),
            description: `Restocked for event shopping list`,
            amount: Number(item.amount),
            unit: item.unit || 'piece',
            purchasePrice: Number(item.purchasePrice) || 0,
            currency: item.currency || 'EUR',
            storageLocation: item.storageLocation || null,
            expirationDate: item.expirationDate ? new Date(item.expirationDate) : null,
        }).returning();
        if (created) insertedIds.push(created.id);
    }

    await invalidateEvent(params.eventId);
    const shoppingList = await computeEventShoppingList({ eventId: params.eventId });
    return {
        success: true,
        insertedCount: insertedIds.length,
        shoppingList,
    };
}

import { GoogleGenAI, Type } from '@google/genai';

export async function scanPrintedPriceListWithGemini(params: {
    eventId?: string;
    imageBase64: string;
    mimeType?: string;
    apiKey: string;
}): Promise<PriceListScanResult> {
    if (!params.apiKey) {
        throw new Error('Gemini API key is not configured (GEMINI_API_KEY).');
    }

    const cleanBase64 = params.imageBase64.replace(/^data:[^;]+;base64,/, '').trim();
    const mimeType = params.mimeType || 'image/jpeg';

    // Load candidate events with prices so we can resolve event by ID, short ID, or title if needed
    let targetEventData = params.eventId ? await loadEventWithPrices(params.eventId) : null;

    const allEventsWithPrices = await db.query.event.findMany({
        limit: 50,
        orderBy: (table, { desc }) => [desc(table.startDateTime), desc(table.createdAt)],
        with: {
            prices: {
                with: {
                    price: {
                        with: {
                            items: true
                        }
                    }
                }
            }
        }
    });

    const candidateEvents = allEventsWithPrices.filter((e) => (e.prices?.length ?? 0) > 0);
    if (!targetEventData?.evt && candidateEvents.length > 0) {
        const first = candidateEvents[0];
        targetEventData = await loadEventWithPrices(first.id);
    }

    // Build known items catalog for the prompt
    const buildCatalogForEvent = (evtObj: any) => {
        const list: {
            priceItemId: string;
            priceListName: string;
            itemName: string;
            unitPrice: number;
            portionAmount: number;
            currency: string;
        }[] = [];
        for (const ep of evtObj?.prices || []) {
            const p = ep.price;
            if (!p) continue;
            for (const it of p.items || []) {
                const portion = Number(it.portionAmount) || 1;
                list.push({
                    priceItemId: it.id,
                    priceListName: p.name,
                    itemName: it.name,
                    unitPrice: round2((Number(it.unitPrice) || 0) * portion),
                    portionAmount: portion,
                    currency: p.currency || evtObj.currency || 'EUR',
                });
            }
        }
        return list;
    };

    const currentCatalog = targetEventData?.evt ? buildCatalogForEvent(targetEventData.evt) : [];
    const candidateEventsPrompt = candidateEvents.map((e) => ({
        eventId: e.id,
        shortCode: e.id.slice(0, 8),
        title: e.summary,
    }));

    const ai = new GoogleGenAI({ apiKey: params.apiKey });

    const systemInstruction = `You are an expert OCR and tally-mark counting assistant for event point-of-sale price lists.
The user is scanning a printed event price list sheet.
On this sheet:
1. Header / Footer may contain an Event QR Code, an Event ID / Short Code (like "ID: 1a2b3c4d" or a UUID), and the Event Title.
2. Each sellable item has a main row with the item name and price, and directly BELOW each item (spanning the full line width below the item) is a rectangular box reserved for handwritten pencil marks (tally marks) to track sold items.
3. Inside each item's rectangular box below the item name, staff pencil in sales using:
   - Vertical tally strokes (| = 1, || = 2, ||| = 3, |||| = 4)
   - 5-stroke tally bundles (four vertical lines crossed by a 5th diagonal or horizontal line = 5)
   - Checkmarks (✓), crosses (x), or ticks (1 each)
   - Or explicit handwritten numbers (e.g., "14" or "= 14").
Carefully inspect the rectangular tally box BELOW each item, count the exact number of marks for that item, and match each item to the provided catalog.`;

    const promptText = `Known candidate events:
${JSON.stringify(candidateEventsPrompt, null, 2)}

${targetEventData?.evt ? `Primary Event (${targetEventData.evt.summary}, ID: ${targetEventData.targetEventId}) Price List Items Catalog:
${JSON.stringify(currentCatalog, null, 2)}` : ''}

Analyze the image of the printed price list:
1. Identify the event ID / short code or title printed on the sheet if visible.
2. For every item in the price list, count all pencil marks inside the full-width rectangular tally box located directly below that item.
3. If a tally box is empty/blank, return countedMarks = 0.
4. Provide a brief markBreakdown explicarion (e.g., "2 bundles of 5 + 3 single strokes = 13" or "Empty box").`;

    const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [
            {
                role: 'user',
                parts: [
                    { text: promptText },
                    { inlineData: { mimeType, data: cleanBase64 } }
                ]
            }
        ],
        config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    detectedEventId: {
                        type: Type.STRING,
                        description: 'Full UUID or 8-char short code printed near the QR code if visible, else empty string'
                    },
                    detectedEventTitle: {
                        type: Type.STRING,
                        description: 'Headline or event title read from the printed price list'
                    },
                    overallNotes: {
                        type: Type.STRING,
                        description: 'General observations about image clarity and tally style'
                    },
                    items: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                priceItemId: {
                                    type: Type.STRING,
                                    description: 'Matching priceItemId from catalog if matched, else empty string'
                                },
                                itemName: {
                                    type: Type.STRING,
                                    description: 'Item name read from the sheet'
                                },
                                countedMarks: {
                                    type: Type.NUMBER,
                                    description: 'Total count of pencil tally marks in the box below this item'
                                },
                                confidence: {
                                    type: Type.STRING,
                                    description: "'high', 'medium', or 'low'"
                                },
                                markBreakdown: {
                                    type: Type.STRING,
                                    description: 'Explanation of how marks were counted (e.g. "1 group of 5 + 2 lines = 7")'
                                }
                            },
                            required: ['itemName', 'countedMarks', 'confidence', 'markBreakdown']
                        }
                    }
                },
                required: ['items']
            }
        }
    });

    const parsed = response.text ? JSON.parse(response.text) : { items: [] };
    const detectedIdRaw = (parsed.detectedEventId || '').trim();
    const detectedTitleRaw = (parsed.detectedEventTitle || '').trim();

    // If no explicit eventId was passed (or if detectedIdRaw matches a known event), resolve the event
    if (!params.eventId && (detectedIdRaw || detectedTitleRaw)) {
        const matchedCandidate = candidateEvents.find((e) =>
            (detectedIdRaw && (e.id.toLowerCase() === detectedIdRaw.toLowerCase() || e.id.toLowerCase().startsWith(detectedIdRaw.toLowerCase()))) ||
            (detectedTitleRaw && normStr(e.summary) === normStr(detectedTitleRaw))
        );
        if (matchedCandidate) {
            targetEventData = await loadEventWithPrices(matchedCandidate.id);
        }
    }

    if (!targetEventData?.evt) {
        throw new Error('Could not resolve target event for the scanned price list.');
    }

    const finalCatalog = buildCatalogForEvent(targetEventData.evt);
    const scannedItemsRaw: any[] = Array.isArray(parsed.items) ? parsed.items : [];

    const resultItems: ScannedTallyItem[] = finalCatalog.map((catItem) => {
        const match = scannedItemsRaw.find(
            (s) =>
                (s.priceItemId && s.priceItemId === catItem.priceItemId) ||
                normStr(s.itemName) === normStr(catItem.itemName) ||
                normStr(catItem.itemName).includes(normStr(s.itemName)) ||
                normStr(s.itemName).includes(normStr(catItem.itemName))
        );

        const countedMarks = match ? Math.max(0, Math.round(Number(match.countedMarks) || 0)) : 0;
        const conf = match?.confidence === 'high' || match?.confidence === 'medium' || match?.confidence === 'low'
            ? match.confidence
            : (match ? 'medium' : 'high');

        return {
            priceItemId: catItem.priceItemId,
            priceListName: catItem.priceListName,
            itemName: catItem.itemName,
            unitPrice: catItem.unitPrice,
            currency: catItem.currency,
            countedMarks,
            confidence: conf,
            markBreakdown: match?.markBreakdown || (countedMarks === 0 ? 'No marks detected' : `${countedMarks} marks`),
        };
    });

    const totalCountedItems = resultItems.reduce((sum, i) => sum + i.countedMarks, 0);
    const estimatedTotalRevenue = round2(
        resultItems.reduce((sum, i) => sum + i.countedMarks * i.unitPrice, 0)
    );

    return {
        detectedEventId: detectedIdRaw || null,
        detectedEventTitle: detectedTitleRaw || null,
        matchedEventId: targetEventData.targetEventId,
        matchedEventSummary: targetEventData.evt.summary,
        items: resultItems,
        totalCountedItems,
        estimatedTotalRevenue,
        currency: targetEventData.evt.currency || 'EUR',
        rawNotes: parsed.overallNotes || undefined,
    };
}
