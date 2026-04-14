import { form } from '$app/server';
import { db } from '$lib/server/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { shiftPlanTemplate } from '@ac/db/schema';
import { updateShiftplanSchema } from '@ac/validations';
import { eq } from 'drizzle-orm';

export const updateShiftplan = form(updateShiftplanSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'shiftplans');
    
    let parsedSchedule = null;
    if (data.schedule) {
        try {
            parsedSchedule = JSON.parse(data.schedule);
        } catch (e) {
            return { error: { message: "Invalid schedule format" } };
        }
    }
    
    await db.update(shiftPlanTemplate).set({
        name: data.name,
        locationId: data.locationId || null,
        schedule: parsedSchedule,
    }).where(eq(shiftPlanTemplate.id, data.id));
    
    return { success: true };
});
