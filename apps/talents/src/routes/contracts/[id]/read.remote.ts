import { query } from '$app/server';
import { db } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import * as v from 'valibot';

export const readContract = query(v.object({ id: v.string() }), async ({ id }) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'contracts');

    const result = await db.query.contract.findFirst({
        where: (table, { eq }) => eq(table.id, id),
        with: {
            frameworks: true
        }
    });

    if (!result) throw new Error('Not found');
    
    return {
        ...result,
        frameworkIds: result.frameworks.map(f => f.frameworkId),
        startDate: result.startDate.toISOString(),
        endDate: result.endDate ? result.endDate.toISOString() : undefined,
        nextStufenaufstiegDate: result.nextStufenaufstiegDate ? result.nextStufenaufstiegDate.toISOString() : undefined,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
    };
});
