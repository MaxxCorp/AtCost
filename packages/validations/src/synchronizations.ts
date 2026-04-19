import * as v from 'valibot';
import { FilterableIdSchema } from './pagination.js';
import type { SyncConfig as DbSyncConfig } from '@ac/db';

/**
 * Synchronization interface matching the database schema, with dates serialized to strings
 */
export type Synchronization = Omit<DbSyncConfig, 'createdAt' | 'updatedAt'> & {
	createdAt: string;
	updatedAt: string;
};

export const synchronizationPaginationSchema = v.optional(v.object({
	page: v.optional(v.number(), 1),
	limit: v.optional(v.number(), 50),
	search: v.optional(v.string()),
	providerType: FilterableIdSchema,
}), {});
