import * as v from 'valibot';
import { type InferSelectModel } from 'drizzle-orm';
import { query } from '$app/server';
import { location } from '@ac/db';
import { listQuery } from '$lib/server/db/query-helpers';

export type Location = InferSelectModel<typeof location>;

/**
 * Query: List all locations (requires authentication + 'locations' access)
 */
export const listLocations = query(v.void_(), async (): Promise<Location[]> => {
    const results = await listQuery({
        table: location,
        featureName: 'locations',
        accessLevel: 'use',
        transform: (row) => ({
            ...row,
        }),
    });
    return results;
});
