import * as v from 'valibot';
import { FilterableIdSchema } from './pagination.js';

// --- MS TEAMS SHIFTS DATA MODEL & SCHEMAS ---

export const SCHEDULE_ENTITY_THEMES = [
    'blue',
    'green',
    'purple',
    'pink',
    'yellow',
    'gray',
    'darkBlue',
    'darkGreen',
    'darkPurple',
    'darkPink',
    'darkYellow',
    'white',
] as const;

export type ScheduleEntityTheme = typeof SCHEDULE_ENTITY_THEMES[number];

export const shiftActivitySchema = v.object({
    id: v.optional(v.string()),
    displayName: v.pipe(v.string(), v.minLength(1, "Activity name is required")),
    code: v.optional(v.string()),
    startTime: v.pipe(v.string(), v.minLength(1, "Start time is required")),
    endTime: v.pipe(v.string(), v.minLength(1, "End time is required")),
    isPaid: v.optional(v.boolean(), false),
});

export type ShiftActivity = v.InferOutput<typeof shiftActivitySchema>;

export const createShiftSchema = v.object({
    displayName: v.optional(v.string()),
    talentId: v.optional(v.nullable(v.string())),
    schedulingGroupId: v.optional(v.nullable(v.string())),
    locationId: v.optional(v.nullable(v.string())),
    startTime: v.pipe(v.string(), v.minLength(1, "Start time is required")),
    endTime: v.pipe(v.string(), v.minLength(1, "End time is required")),
    theme: v.optional(v.string(), "blue"),
    notes: v.optional(v.string()),
    isShared: v.optional(v.boolean(), false),
    openSlotCount: v.optional(v.number(), 1),
    activities: v.optional(v.array(shiftActivitySchema), []),
});

export type CreateShiftInput = v.InferOutput<typeof createShiftSchema>;

export const updateShiftSchema = v.object({
    id: v.pipe(v.string(), v.uuid("Invalid shift ID")),
    displayName: v.optional(v.nullable(v.string())),
    talentId: v.optional(v.nullable(v.string())),
    schedulingGroupId: v.optional(v.nullable(v.string())),
    locationId: v.optional(v.nullable(v.string())),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    theme: v.optional(v.string()),
    notes: v.optional(v.nullable(v.string())),
    isShared: v.optional(v.boolean()),
    openSlotCount: v.optional(v.number()),
    activities: v.optional(v.array(shiftActivitySchema)),
});

export type UpdateShiftInput = v.InferOutput<typeof updateShiftSchema>;

export const deleteShiftSchema = v.object({
    id: v.pipe(v.string(), v.uuid("Invalid shift ID")),
});

export const listShiftsSchema = v.object({
    startDate: v.string(), // ISO date/time for week start
    endDate: v.string(),   // ISO date/time for week end
    locationId: v.optional(v.string()),
    schedulingGroupId: v.optional(v.string()),
    talentId: v.optional(v.string()),
});

export type ListShiftsInput = v.InferOutput<typeof listShiftsSchema>;

// MS Teams POST /teams/{team-id}/schedule/share compatibility
export const shareScheduleSchema = v.object({
    startDate: v.string(),
    endDate: v.string(),
    locationId: v.optional(v.string()),
    notifyTeam: v.optional(v.boolean(), true),
});

export type ShareScheduleInput = v.InferOutput<typeof shareScheduleSchema>;

// MS Teams schedule copy compatibility (copy varying or repeating week to future week)
export const copyScheduleSchema = v.object({
    sourceStartDate: v.string(),
    sourceEndDate: v.string(),
    targetStartDate: v.string(),
    locationId: v.optional(v.string()),
    includeAssignedTalents: v.optional(v.boolean(), true),
});

export type CopyScheduleInput = v.InferOutput<typeof copyScheduleSchema>;

export const createSchedulingGroupSchema = v.object({
    name: v.pipe(v.string(), v.minLength(1, "Group name is required")),
    code: v.optional(v.nullable(v.string())),
    color: v.optional(v.string(), "purple"),
    locationId: v.optional(v.nullable(v.string())),
});

export type CreateSchedulingGroupInput = v.InferOutput<typeof createSchedulingGroupSchema>;

export const updateSchedulingGroupSchema = v.object({
    id: v.pipe(v.string(), v.uuid("Invalid group ID")),
    name: v.pipe(v.string(), v.minLength(1, "Group name is required")),
    code: v.optional(v.nullable(v.string())),
    color: v.optional(v.string(), "purple"),
    locationId: v.optional(v.nullable(v.string())),
});

export type UpdateSchedulingGroupInput = v.InferOutput<typeof updateSchedulingGroupSchema>;

export const deleteSchedulingGroupSchema = v.object({
    id: v.pipe(v.string(), v.uuid("Invalid group ID")),
});

export interface ShiftDetail {
    id: string;
    displayName: string | null;
    talentId: string | null;
    talentName: string | null;
    talentAvatar: string | null;
    schedulingGroupId: string | null;
    schedulingGroupName: string | null;
    locationId: string | null;
    locationName: string | null;
    startTime: string;
    endTime: string;
    theme: string;
    isShared: boolean;
    openSlotCount: number;
    activities: ShiftActivity[] | null;
    notes: string | null;
    externalId: string | null;
    syncStatus: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface SchedulingGroupDetail {
    id: string;
    name: string;
    code: string | null;
    color: string;
    locationId: string | null;
    order: number;
}

// --- REUSABLE TEMPLATES / PRESETS (Backward Compatibility) ---

export const createShiftplanSchema = v.object({
    name: v.pipe(v.string(), v.minLength(1, "Name is required")),
    locationId: v.optional(v.string()),
    schedule: v.optional(v.string()), // A stringified JSON configuration of days
});

export const updateShiftplanSchema = v.object({
    id: v.string(),
    name: v.pipe(v.string(), v.minLength(1, "Name is required")),
    locationId: v.optional(v.string()),
    schedule: v.optional(v.string()),
});

export const ShiftplanPaginationSchema = v.optional(v.object({
    page: v.optional(v.number(), 1),
    limit: v.optional(v.number(), 50),
    search: v.optional(v.string()),
    locationId: FilterableIdSchema,
}), {});

export interface ShiftplanOverview {
    id: string;
    name: string;
    schedule: any;
    createdAt: string;
    locationName: string | null;
}
