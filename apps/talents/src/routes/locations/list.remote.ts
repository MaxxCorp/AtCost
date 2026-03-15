import { type InferSelectModel } from 'drizzle-orm';
import { query } from '$app/server';
import { location } from '$lib/server/db/schema';
import { listQuery } from '$lib/server/db/query-helpers';

export type Location = InferSelectModel<typeof location>;

export const listLocations = query(async (): Promise<Location[]> => {
    const results = await listQuery({
        table: location,
        featureName: 'locations',
        transform: (row) => ({
            ...row,
        }),
    });
    return results;
});
