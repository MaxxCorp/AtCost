import {
    INVENTORY_RETRIEVAL_MODES,
    recordEventSalesSchema,
    deleteEventSaleSchema,
    saleLineItemInputSchema,
} from '@ac/validations';

export const posCorsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-POS-Key',
};

/**
 * Automatically converts a Valibot schema AST into an OpenAPI 3.1 / JSON Schema object.
 */
export function valibotToOpenApiSchema(schema: any): Record<string, any> {
    if (!schema || typeof schema !== 'object') {
        return { type: 'string' };
    }

    // Handle optional / nullable wrappers
    if (schema.type === 'optional') {
        const inner = valibotToOpenApiSchema(schema.wrapped);
        if (schema.default !== undefined && typeof schema.default !== 'function') {
            inner.default = schema.default;
        }
        return inner;
    }

    if (schema.type === 'nullable') {
        const inner = valibotToOpenApiSchema(schema.wrapped);
        return {
            ...inner,
            nullable: true,
        };
    }

    // Handle pipe wrapper (first item in pipe is the root schema)
    if (Array.isArray(schema.pipe) && schema.pipe.length > 0 && schema.pipe[0] !== schema) {
        const base = valibotToOpenApiSchema(schema.pipe[0]);
        for (const step of schema.pipe.slice(1)) {
            if (step?.type === 'min_length' && typeof step.requirement === 'number') {
                base.minLength = step.requirement;
            } else if (step?.type === 'min_value' && typeof step.requirement === 'number') {
                base.minimum = step.requirement;
            } else if (step?.type === 'uuid') {
                base.format = 'uuid';
            }
        }
        return base;
    }

    switch (schema.type) {
        case 'string':
            return { type: 'string' };
        case 'number':
            return { type: 'number' };
        case 'boolean':
            return { type: 'boolean' };
        case 'literal':
            return {
                type: typeof schema.literal === 'number' ? 'number' : 'string',
                enum: [schema.literal],
            };
        case 'picklist':
            return {
                type: 'string',
                enum: Array.isArray(schema.options) ? [...schema.options] : [],
            };
        case 'union': {
            const options = Array.isArray(schema.options) ? schema.options : [];
            // If union of number and string (coerced number), expose as number
            const types = options.map((o: any) => o?.type);
            if (types.includes('number')) {
                return { type: 'number' };
            }
            return {
                oneOf: options.map((o: any) => valibotToOpenApiSchema(o)),
            };
        }
        case 'array':
            return {
                type: 'array',
                items: valibotToOpenApiSchema(schema.item),
            };
        case 'object': {
            const entries = schema.entries || {};
            const properties: Record<string, any> = {};
            const required: string[] = [];

            for (const [key, propSchema] of Object.entries<any>(entries)) {
                properties[key] = valibotToOpenApiSchema(propSchema);
                if (propSchema?.type !== 'optional') {
                    required.push(key);
                }
            }

            return {
                type: 'object',
                properties,
                ...(required.length > 0 ? { required } : {}),
            };
        }
        default:
            return { type: 'string' };
    }
}

export function generatePosOpenApiSpec(baseUrl: string) {
    const recordSalesOpenApi = valibotToOpenApiSchema(recordEventSalesSchema);
    // Remove eventId from POST body requirement because it is supplied in path `/api/pos/events/{id}/sales`
    if (recordSalesOpenApi.properties?.eventId) {
        delete recordSalesOpenApi.properties.eventId;
        if (Array.isArray(recordSalesOpenApi.required)) {
            recordSalesOpenApi.required = recordSalesOpenApi.required.filter((k: string) => k !== 'eventId');
        }
    }

    const deleteSaleOpenApi = valibotToOpenApiSchema(deleteEventSaleSchema);
    if (deleteSaleOpenApi.properties?.eventId) {
        delete deleteSaleOpenApi.properties.eventId;
        if (Array.isArray(deleteSaleOpenApi.required)) {
            deleteSaleOpenApi.required = deleteSaleOpenApi.required.filter((k: string) => k !== 'eventId');
        }
    }

    const saleLineItemOpenApi = valibotToOpenApiSchema(saleLineItemInputSchema);

    return {
        openapi: '3.1.0',
        info: {
            title: 'AtCost Event Point of Sale (POS) & Inventory API',
            version: '1.0.0',
            description:
                'REST API for Point of Sale (POS) terminals and event sales tracking. Supports retrieving sellable price list items for an event, recording live or batch sales, automatic inventory deduction with selectable retrieval modes (FIFO, FEFO, LIFO, Lowest Cost, Highest Cost), and querying real-time financial results.',
        },
        servers: [
            {
                url: baseUrl,
                description: 'Current Application Server',
            },
        ],
        paths: {
            '/api/pos/events': {
                get: {
                    operationId: 'listPosEvents',
                    summary: 'List events with price lists available for Point of Sale',
                    tags: ['POS Events'],
                    responses: {
                        '200': {
                            description: 'List of events with associated price lists',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            data: {
                                                type: 'array',
                                                items: { $ref: '#/components/schemas/PosEventSummary' },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            '/api/pos/events/{id}/items': {
                get: {
                    operationId: 'getPosEventItems',
                    summary: 'Retrieve sellable price list items and stock availability for an event',
                    tags: ['POS Items'],
                    parameters: [
                        {
                            name: 'id',
                            in: 'path',
                            required: true,
                            description: 'Event UUID',
                            schema: { type: 'string', format: 'uuid' },
                        },
                    ],
                    responses: {
                        '200': {
                            description: 'Event sellable items, stock availability, and current sales counts',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            eventId: { type: 'string', format: 'uuid' },
                                            eventSummary: { type: 'string' },
                                            currency: { type: 'string' },
                                            participantsCount: { type: 'number' },
                                            qrCodeUrl: { type: 'string' },
                                            items: {
                                                type: 'array',
                                                items: { $ref: '#/components/schemas/PosSellableItem' },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        '404': { description: 'Event not found' },
                    },
                },
            },
            '/api/pos/events/{id}/sales': {
                get: {
                    operationId: 'getPosEventSales',
                    summary: 'Get recorded sales, per-item summaries, and financial result for an event',
                    tags: ['POS Sales & Financials'],
                    parameters: [
                        {
                            name: 'id',
                            in: 'path',
                            required: true,
                            description: 'Event UUID',
                            schema: { type: 'string', format: 'uuid' },
                        },
                    ],
                    responses: {
                        '200': {
                            description: 'Event financial result and sales history',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/EventFinancialResult' },
                                },
                            },
                        },
                    },
                },
                post: {
                    operationId: 'recordPosEventSales',
                    summary: 'Record sold items from POS and update consumable inventory',
                    description:
                        'Records one or more sold price list items for the event, deducts required ingredients/consumables from stock using the chosen retrievalMode (e.g. FIFO, FEFO, LIFO), and returns the updated financial result.',
                    tags: ['POS Sales & Financials'],
                    parameters: [
                        {
                            name: 'id',
                            in: 'path',
                            required: true,
                            description: 'Event UUID',
                            schema: { type: 'string', format: 'uuid' },
                        },
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/RecordEventSalesRequest' },
                            },
                        },
                    },
                    responses: {
                        '200': {
                            description: 'Sales recorded and inventory updated',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            success: { type: 'boolean' },
                                            createdSalesCount: { type: 'number' },
                                            financials: { $ref: '#/components/schemas/EventFinancialResult' },
                                        },
                                    },
                                },
                            },
                        },
                        '400': { description: 'Validation error' },
                    },
                },
                delete: {
                    operationId: 'deletePosEventSale',
                    summary: 'Delete a sale record and optionally restore deducted inventory',
                    tags: ['POS Sales & Financials'],
                    parameters: [
                        {
                            name: 'id',
                            in: 'path',
                            required: true,
                            description: 'Event UUID',
                            schema: { type: 'string', format: 'uuid' },
                        },
                        {
                            name: 'saleId',
                            in: 'query',
                            required: false,
                            description: 'Sale UUID to delete (can also be passed in request body)',
                            schema: { type: 'string', format: 'uuid' },
                        },
                        {
                            name: 'restoreInventory',
                            in: 'query',
                            required: false,
                            description: 'Whether to restore deducted stock back to consumable batches (default: true)',
                            schema: { type: 'boolean', default: true },
                        },
                    ],
                    requestBody: {
                        required: false,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/DeleteEventSaleRequest' },
                            },
                        },
                    },
                    responses: {
                        '200': {
                            description: 'Sale deleted and updated financial result returned',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            success: { type: 'boolean' },
                                            financials: { $ref: '#/components/schemas/EventFinancialResult' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        components: {
            schemas: {
                InventoryRetrievalMode: {
                    type: 'string',
                    enum: [...INVENTORY_RETRIEVAL_MODES],
                    description:
                        'Stock deduction ordering: fifo (First-In First-Out), fefo (First-Expired First-Out), lifo (Last-In First-Out), lowest_cost, highest_cost, or none.',
                },
                SaleLineItemInput: saleLineItemOpenApi,
                RecordEventSalesRequest: recordSalesOpenApi,
                DeleteEventSaleRequest: deleteSaleOpenApi,
                PosEventSummary: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        summary: { type: 'string' },
                        startDateTime: { type: 'string', nullable: true },
                        endDateTime: { type: 'string' },
                        currency: { type: 'string' },
                        participantsCount: { type: 'number' },
                        priceListsCount: { type: 'number' },
                        qrCodeUrl: { type: 'string' },
                        itemsEndpoint: { type: 'string' },
                        salesEndpoint: { type: 'string' },
                    },
                },
                PosSellableItem: {
                    type: 'object',
                    properties: {
                        priceItemId: { type: 'string', format: 'uuid' },
                        priceId: { type: 'string', format: 'uuid' },
                        priceListName: { type: 'string' },
                        name: { type: 'string' },
                        description: { type: 'string', nullable: true },
                        itemType: { type: 'string', enum: ['consumable', 'recipe'] },
                        unit: { type: 'string', nullable: true },
                        portionAmount: { type: 'number' },
                        unitPrice: { type: 'number' },
                        baseCostPrice: { type: 'number' },
                        currency: { type: 'string' },
                        plannedQuantity: { type: 'number' },
                        soldQuantity: { type: 'number' },
                        availablePortionsInStock: { type: 'number' },
                    },
                },
                EventFinancialResult: {
                    type: 'object',
                    properties: {
                        eventId: { type: 'string', format: 'uuid' },
                        eventSummary: { type: 'string' },
                        participantsCount: { type: 'number' },
                        currency: { type: 'string' },
                        plannedTotalRevenue: { type: 'number' },
                        plannedTotalCost: { type: 'number' },
                        plannedTotalProfit: { type: 'number' },
                        actualTotalRevenue: { type: 'number' },
                        actualTotalCost: { type: 'number' },
                        actualTotalProfit: { type: 'number' },
                        actualMarginPercent: { type: 'number' },
                        revenueAttainmentPercent: { type: 'number' },
                        profitVariance: { type: 'number' },
                        totalPortionsSold: { type: 'number' },
                        totalTransactionsCount: { type: 'number' },
                        itemSummaries: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/PosSellableItem' },
                        },
                        salesHistory: {
                            type: 'array',
                            items: { type: 'object' },
                        },
                    },
                },
            },
        },
    };
}
