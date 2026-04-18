import { query } from '$app/server';
import { db, shiftPlanTemplate, location, eq, desc } from '$lib/server/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import type { ShiftPlanTemplate } from '@ac/db';
import * as v from 'valibot';

export interface ShiftplanOverview {
    id: string;
    name: string;
    schedule: any;
    createdAt: Date;
    locationName: string | null;
}

export const listShiftplans = query(v.undefined_(), async (): Promise<any[]> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'shiftplans');
    
    return await db
        .select({
            id: shiftPlanTemplate.id,
            name: shiftPlanTemplate.name,
            schedule: shiftPlanTemplate.schedule,
            createdAt: shiftPlanTemplate.createdAt,
            locationName: location.name,
        })
        .from(shiftPlanTemplate)
        .leftJoin(location, eq(shiftPlanTemplate.locationId, location.id) as any)
        .orderBy(desc(shiftPlanTemplate.createdAt) as any);
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
