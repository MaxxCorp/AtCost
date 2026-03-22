import * as v from 'valibot';

export const clockInSchema = v.object({
    talentId: v.string(),
    locationId: v.optional(v.string()),
    type: v.union([v.literal('qr'), v.literal('gps'), v.literal('manual')]),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
});

export const clockOutSchema = v.object({
    entryId: v.string(),
    talentId: v.string(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
});

export const timesheetApprovalSchema = v.object({
    entryId: v.string(),
    comment: v.optional(v.string()),
});

export const timesheetManualUpdateSchema = v.object({
    entryId: v.string(),
    startTime: v.optional(v.string()), // ISO string
    endTime: v.optional(v.string()), // ISO string
    status: v.optional(v.union([v.literal('pending'), v.literal('approved'), v.literal('rejected')])),
    managerComment: v.optional(v.string()),
});

export const shiftPlanSchema = v.object({
    talentId: v.string(),
    locationId: v.optional(v.string()),
    startTime: v.string(), // ISO string
    endTime: v.string(), // ISO string
    notes: v.optional(v.string()),
});
