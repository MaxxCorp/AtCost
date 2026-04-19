import type { SyncConfig as DbSyncConfig } from '@ac/db';

/**
 * Synchronization interface matching the database schema, with dates serialized to strings
 */
export type Synchronization = Omit<DbSyncConfig, 'createdAt' | 'updatedAt'> & {
	createdAt: string;
	updatedAt: string;
};
