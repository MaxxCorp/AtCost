import { form } from '$app/server';
import { db } from '$lib/server/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { shiftPlanTemplate } from '@ac/db/schema';
import { createShiftplanSchema } from '@ac/validations';

export const createShiftplan = form(createShiftplanSchema, async (data) => {
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
    
    const [inserted] = await db.insert(shiftPlanTemplate).values({
        name: data.name,
        locationId: data.locationId || null,
        schedule: parsedSchedule,
    }).returning({ id: shiftPlanTemplate.id });
    
    return inserted;
});
