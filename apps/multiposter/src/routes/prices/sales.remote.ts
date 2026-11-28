import { command, query, requested } from '$app/server';
import { GEMINI_API_KEY } from '$app/env/private';
import * as v from 'valibot';
import {
    getEventShoppingListSchema,
    restockShoppingListItemsSchema,
    getEventSalesSchema,
    recordEventSalesSchema,
    deleteEventSaleSchema,
    scanPriceListTalliesSchema,
} from '@ac/validations';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import {
    computeEventShoppingList,
    restockShoppingListItems,
    getEventSalesAndFinancials,
    recordEventSales,
    removeEventSaleRecord,
    scanPrintedPriceListWithGemini,
} from '#lib/server/events/sales.js';
import { listConsumables } from '../consumables/list.remote.js';
import { commitEventChange } from '#lib/server/events/sync-commit.js';

export const getEventShoppingList = query(getEventShoppingListSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'events');
    return computeEventShoppingList(data);
});

export const getEventSales = query(getEventSalesSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'events');
    return getEventSalesAndFinancials(data);
});

async function refreshSalesRelatedQueries(eventId: string, user?: { id: string; name?: string | null; email?: string | null }) {
    await commitEventChange({
        action: 'update',
        ids: [eventId],
        user,
        extraRefresh: async () => {
            try { await requested(getEventSales, 20).refreshAll(); } catch { /* ignore */ }
            try { await requested(getEventShoppingList, 20).refreshAll(); } catch { /* ignore */ }
            try { await requested(listConsumables, 20).refreshAll(); } catch { /* ignore */ }
            void getEventSales({ eventId }).refresh();
            void getEventShoppingList({ eventId }).refresh();
            void listConsumables().refresh();
            void listConsumables({}).refresh();
        }
    });
}

export const recordSalesCommand = command(recordEventSalesSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'events');

    const result = await recordEventSales({
        ...data,
        userId: user.id,
    });

    await refreshSalesRelatedQueries(data.eventId, user);
    return result;
});

export const deleteSaleCommand = command(deleteEventSaleSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'events');

    const result = await removeEventSaleRecord(data);

    await refreshSalesRelatedQueries(data.eventId, user);
    return result;
});

export const restockEventShoppingList = command(restockShoppingListItemsSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'consumables');

    const result = await restockShoppingListItems({
        eventId: data.eventId,
        items: data.items,
        userId: user.id,
    });

    await refreshSalesRelatedQueries(data.eventId, user);
    return result;
});

export const isPriceListScanAvailable = query(async () => {
    return !!GEMINI_API_KEY;
});

export const scanPriceListTallies = command(scanPriceListTalliesSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'events');

    if (!GEMINI_API_KEY) {
        return {
            success: false as const,
            error: 'Gemini API key (GEMINI_API_KEY) is not configured.',
        };
    }

    try {
        const result = await scanPrintedPriceListWithGemini({
            eventId: data.eventId,
            imageBase64: data.imageBase64,
            mimeType: data.mimeType,
            apiKey: GEMINI_API_KEY,
        });
        return {
            success: true as const,
            data: result,
        };
    } catch (err: any) {
        console.error('Error scanning price list tallies:', err);
        return {
            success: false as const,
            error: err?.message || 'Failed to scan price list.',
        };
    }
});
