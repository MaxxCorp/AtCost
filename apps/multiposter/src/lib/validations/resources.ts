import * as v from 'valibot';

export interface AllocationCalendar {
    provider: string;
    calendarId: string;
}

export const resourceBaseSchema = v.object({
    name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
    description: v.optional(v.string()),
    type: v.pipe(v.string(), v.minLength(1, 'Resource type is required')),
    maxOccupancy: v.optional(v.union([v.number(), v.string()])), 
    locationId: v.optional(v.string()),
    inventoryNumber: v.optional(v.string()),
    locationIds: v.optional(v.union([v.string(), v.array(v.string())])),
    allocationCalendars: v.optional(v.union([v.string(), v.array(v.any())])),
    parentResourceIds: v.optional(v.union([v.string(), v.array(v.string())])),
    contactIds: v.optional(v.union([v.string(), v.array(v.string())])),
});

export const createResourceSchema = resourceBaseSchema;
export const updateResourceSchema = v.intersect([
    resourceBaseSchema,
    v.object({ id: v.pipe(v.string()) })
]);
export const deleteResourceSchema = v.array(v.pipe(v.string()));

