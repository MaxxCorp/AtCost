import * as v from 'valibot';
import { type InferSelectModel, db, desc } from '$lib/server/db';
import { query } from '$app/server';
import { location } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';

export type Location = Omit<InferSelectModel<typeof location>, 'createdAt' | 'updatedAt'> & {
    createdAt: string;
    updatedAt: string;
};

export const listLocations = query(v.undefined_(), async (): Promise<Location[]> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'locations');

    const rawResults = await db
        .select()
        .from(location)
        .orderBy(desc(location.createdAt));

    return rawResults.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    }));
});
