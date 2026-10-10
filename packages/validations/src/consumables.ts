import * as v from 'valibot';
import type { Consumable as DbConsumable } from '@ac/db';

export type Consumable = Omit<DbConsumable, 'createdAt' | 'updatedAt' | 'expirationDate'> & {
    expirationDate: string | null;
    createdAt: string;
    updatedAt: string;
    costPerUnit?: number;
    user?: {
        id: string;
        name: string | null;
        email: string;
    };
};

export const consumablePaginationSchema = v.optional(v.object({
    page: v.optional(v.number(), 1),
    limit: v.optional(v.number(), 50),
    search: v.optional(v.string()),
    storageLocation: v.optional(v.string()),
    sortField: v.optional(v.union([
        v.literal('name'),
        v.literal('displayName'),
        v.literal('purchasePrice'),
        v.literal('amount'),
        v.literal('storageLocation'),
        v.literal('expirationDate'),
        v.literal('createdAt'),
        v.literal('updatedAt')
    ])),
    sortOrder: v.optional(v.union([v.literal('asc'), v.literal('desc')])),
}), {});

export const createConsumableSchema = v.object({
    name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
    description: v.optional(v.string()),
    purchasePrice: v.optional(v.union([v.number(), v.string()]), 0),
    unit: v.optional(v.pipe(v.string(), v.minLength(1, 'Unit is required')), 'piece'),
    amount: v.optional(v.union([v.number(), v.string()]), 1),
    storageLocation: v.optional(v.string()),
    expirationDate: v.optional(v.string()),
});

export const updateConsumableSchema = v.object({
    id: v.pipe(v.string(), v.minLength(1)),
    name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
    description: v.optional(v.string()),
    purchasePrice: v.optional(v.union([v.number(), v.string()]), 0),
    unit: v.optional(v.pipe(v.string(), v.minLength(1, 'Unit is required')), 'piece'),
    amount: v.optional(v.union([v.number(), v.string()]), 1),
    storageLocation: v.optional(v.string()),
    expirationDate: v.optional(v.string()),
});
