import * as v from 'valibot';
import { PaginationBaseSchema, FilterableIdSchema } from './pagination.js';

export const TimeOffPaginationSchema = v.intersect([
    PaginationBaseSchema,
    v.object({
        talentId: v.optional(FilterableIdSchema),
        type: v.optional(FilterableIdSchema),
        status: v.optional(FilterableIdSchema),
    })
]);

export const reviewTimeOffSchema = v.object({
    requestId: v.pipe(v.string(), v.minLength(1, "Request ID is required")),
    action: v.picklist(["approve", "reject"]),
    comment: v.optional(v.string()),
});

export type ReviewTimeOffInput = v.InferInput<typeof reviewTimeOffSchema>;

export const talentAbsenceAwarenessInputSchema = v.object({
    talentId: v.pipe(v.string(), v.minLength(1, "Talent ID is required")),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    currentRequestId: v.optional(v.string()),
});

export type TalentAbsenceAwarenessInput = v.InferInput<typeof talentAbsenceAwarenessInputSchema>;

export const teamSurroundingAbsencesInputSchema = v.object({
    startDate: v.string(),
    endDate: v.string(),
    excludeTalentId: v.optional(v.string()),
    tagId: v.optional(FilterableIdSchema),
    talentId: v.optional(FilterableIdSchema),
    locationId: v.optional(FilterableIdSchema),
    status: v.optional(FilterableIdSchema),
    type: v.optional(FilterableIdSchema),
    search: v.optional(v.string()),
});

export type TeamSurroundingAbsencesInput = v.InferInput<typeof teamSurroundingAbsencesInputSchema>;

export type TimeOff = {
    id: string;
    talentId: string;
    type: string;
    start: string;
    end: string;
    note?: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
};
