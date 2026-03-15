import { type InferSelectModel } from 'drizzle-orm';
import { query } from '$app/server';
import { location } from '$lib/server/db/schema';
import { listQuery } from '$lib/server/db/query-helpers';
import { getOptionalUser } from '$lib/server/authorization';

export type Location = InferSelectModel<typeof location>;

/**
 * Query: List all locations for the current user
 */
export const listLocations = query(async (): Promise<Location[]> => {
    const user = getOptionalUser();
    if (!user) return [];

    const results = await listQuery({
        table: location,
        featureName: 'locations',
        transform: (row) => ({
            ...row,
        }),
    });
    return results;
});
