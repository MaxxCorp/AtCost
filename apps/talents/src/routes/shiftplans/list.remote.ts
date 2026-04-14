import { query } from '$app/server';
import { db } from '$lib/server/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { shiftPlanTemplate, location, type ShiftPlanTemplate } from '@ac/db/schema';
import { eq, desc } from 'drizzle-orm';
import * as v from 'valibot';

export interface ShiftplanOverview {
    id: string;
    name: string;
    schedule: any;
    createdAt: Date;
    locationName: string | null;
}

export const listShiftplans = query(v.void_(), async (): Promise<ShiftplanOverview[]> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'shiftplans');
    
    const results = await db
        .select({
            id: shiftPlanTemplate.id,
            name: shiftPlanTemplate.name,
            schedule: shiftPlanTemplate.schedule,
            createdAt: shiftPlanTemplate.createdAt,
            locationName: location.name,
        })
        .from(shiftPlanTemplate)
        .leftJoin(location, eq(shiftPlanTemplate.locationId, location.id))
        .orderBy(desc(shiftPlanTemplate.createdAt));
        
    return results as any[];
});

export const getShiftplan = query(v.string(), async (id: string): Promise<ShiftPlanTemplate | null> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'shiftplans');
    
    const [result] = await db
        .select()
        .from(shiftPlanTemplate)
        .where(eq(shiftPlanTemplate.id, id));
    return result || null;
});
