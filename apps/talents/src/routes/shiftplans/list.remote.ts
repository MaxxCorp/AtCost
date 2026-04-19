import { query } from '$app/server';
import { db, shiftPlanTemplate, location, eq, desc, sql, and, or, ilike } from '$lib/server/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import type { ShiftPlanTemplate } from '@ac/db';
import * as v from 'valibot';

import { ShiftplanPaginationSchema as PaginationSchema, type ShiftplanOverview, type PaginatedResult } from '@ac/validations';


export const listShiftplans = query(PaginationSchema, async (input): Promise<PaginatedResult<any>> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'shiftplans');

        const { page = 1, limit = 50, search = '', locationId } = input || {};
        const offset = (page - 1) * limit;

        let baseQuery = db.select({
            id: shiftPlanTemplate.id,
            name: shiftPlanTemplate.name,
            schedule: shiftPlanTemplate.schedule,
            createdAt: shiftPlanTemplate.createdAt,
            locationName: location.name,
        }).from(shiftPlanTemplate)
        .leftJoin(location, eq(shiftPlanTemplate.locationId, location.id) as any)
        .$dynamic();
        
        const conditions: any[] = [];
        if (search) {
            conditions.push(or(
                ilike(shiftPlanTemplate.name, `%${search}%`),
                ilike(location.name, `%${search}%`)
            ));
        }

        if (locationId) {
            const { inArray } = await import('drizzle-orm');
            const ids = Array.isArray(locationId) ? locationId : [locationId];
            if (ids.length > 0) {
                conditions.push(inArray(shiftPlanTemplate.locationId, ids as any));
            }
        }

    if (conditions.length > 0) {
        baseQuery = baseQuery.where(and(...conditions as any)) as any;
    }

    const countResult = await db.execute(sql`SELECT count(*) FROM (${baseQuery}) AS subquery`);
    const total = Number(countResult[0]?.count || 0);

    const data = (await baseQuery
        .orderBy(desc(shiftPlanTemplate.createdAt) as any)
        .limit(limit)
        .offset(offset)).map(row => ({
            ...row,
            createdAt: row.createdAt.toISOString()
        }));

    return { data, total };

});

export const getShiftplan = query(v.string(), async (id): Promise<ShiftPlanTemplate | null> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'shiftplans');
    
    const [result] = await db
        .select()
        .from(shiftPlanTemplate)
        .where(eq(shiftPlanTemplate.id, id) as any);
    return (result as ShiftPlanTemplate) || null;
});
