import type { Campaign as DbCampaign } from '@ac/db';

/**
 * Campaign interface matching the database schema, with dates serialized to strings
 */
export type Campaign = Omit<DbCampaign, 'createdAt' | 'updatedAt'> & {
	createdAt: string;
	updatedAt: string;
};
