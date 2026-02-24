/**
 * Reusable utility for common database query patterns
 */
import { db } from '$lib/server/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { eq, desc, type SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { Feature } from '@ac/auth';

export interface ListQueryConfig<T extends PgTable> {
    table: T;
    featureName: Feature;
    orderBy?: SQL;
    transform?: (row: any) => any;
}

export async function listQuery<T extends PgTable>(config: ListQueryConfig<T>): Promise<any[]> {
    const { table, featureName, orderBy: customOrderBy, transform } = config;

    const user = getAuthenticatedUser();
    ensureAccess(user, featureName);

    const query = db
        .select()
        .from(table as any);

    if (customOrderBy) {
        query.orderBy(customOrderBy);
    } else if ((table as any).createdAt) {
        query.orderBy(desc((table as any).createdAt));
    }

    const results = await query;

    if (transform) {
        return results.map(transform);
    }

    return results;
}

export interface GetQueryConfig<T extends PgTable> {
    table: T;
    featureName: Feature;
    id: string;
    transform?: (row: any) => any;
}

export async function getQuery<T extends PgTable>(config: GetQueryConfig<T>): Promise<any | null> {
    const { table, featureName, id, transform } = config;

    const user = getAuthenticatedUser();
    ensureAccess(user, featureName);

    const results = await db
        .select()
        .from(table as any)
        .where(eq((table as any).id, id))
        .limit(1);

    if (results.length === 0) return null;

    if (transform) {
        return transform(results[0]);
    }

    return results[0];
}
