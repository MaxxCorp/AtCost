import * as v from "valibot";

export const timelineEntryType = v.picklist(["Interview", "Hiring", "Evaluation", "Termination"]);

export const nextStepSchema = v.object({
    name: v.pipe(v.string(), v.minLength(1, "Next step name is required")),
    date: v.pipe(v.string(), v.minLength(1, "Date is required")),
    responsibleEmployeeId: v.pipe(v.string(), v.minLength(1, "Responsible employee is required")),
});

export const talentTimelineEntrySchema = v.object({
    type: timelineEntryType,
    description: v.optional(v.string()),
    date: v.pipe(v.string(), v.minLength(1, "Date is required")),
    comment: v.pipe(v.string(), v.minLength(1, "Comment is required")),
    nextStep: v.optional(nextStepSchema),
});

export const createTalentSchema = v.object({
    contactId: v.pipe(v.string(), v.minLength(1, "Contact is required")),
});

export const updateTalentSchema = v.object({
    id: v.pipe(v.string(), v.minLength(1)),
    contactId: v.pipe(v.string(), v.minLength(1, "Contact is required")),
});
