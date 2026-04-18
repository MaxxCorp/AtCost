import { query } from '$app/server';
import { db, shiftPlanTemplate, inArray } from '$lib/server/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import * as v from 'valibot';

export const deleteShiftplans = query(v.array(v.string()), async (ids) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'shiftplans');
    
    if (!ids.length) return { success: true };
    await db.delete(shiftPlanTemplate).where(inArray(shiftPlanTemplate.id, ids));
    return { success: true };
});
