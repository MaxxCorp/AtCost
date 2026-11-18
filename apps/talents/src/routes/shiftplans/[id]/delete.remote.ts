import { command, requested } from '$app/server';
import { db, shiftPlanTemplate, inArray } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import * as v from 'valibot';
import { listShiftplans } from '../list.remote';

export const deleteShiftplans = command(v.array(v.string()), async (ids) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'shiftplans');
    
    if (!ids.length) return { success: true };
    await db.delete(shiftPlanTemplate).where(inArray(shiftPlanTemplate.id, ids));
    try { await requested(listShiftplans, 20).refreshAll(); } catch { /* ignore */ }
    void listShiftplans().refresh();
    void listShiftplans({}).refresh();
    return { success: true };
});
