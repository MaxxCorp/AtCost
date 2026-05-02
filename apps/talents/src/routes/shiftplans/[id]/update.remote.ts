import { form } from '$app/server';
import { db, shiftPlanTemplate } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { updateShiftplanSchema } from '@ac/validations';
import { eq } from '@ac/db';

export const updateShiftplan = form(updateShiftplanSchema, async (data): Promise<{ success: boolean; error?: { message: string } }> => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'shiftplans');
    
    let parsedSchedule = null;
    if (data.schedule) {
        try {
            parsedSchedule = typeof data.schedule === 'string' ? JSON.parse(data.schedule) : data.schedule;
        } catch (e) {
            return { success: false, error: { message: "Invalid schedule format" } };
        }
    }
    
    await db.update(shiftPlanTemplate).set({
        name: data.name,
        locationId: data.locationId || null,
        schedule: parsedSchedule,
    }).where(eq(shiftPlanTemplate.id, data.id));
    
    return { success: true };
});
