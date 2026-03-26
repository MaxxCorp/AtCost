import * as v from "valibot";
import { contactBaseSchema, emailSchemaPure, phoneSchemaPure, addressSchemaPure, contactRelationSchemaPure } from './contacts';

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
    status: v.optional(v.picklist(["active", "inactive", "applicant"]), "applicant"),
    jobTitle: v.optional(v.string()),
    salaryExpectation: v.optional(v.string()),
    availabilityDate: v.optional(v.string()), // Expect ISO string from form
    onboardingStatus: v.optional(v.string()),
    resumeUrl: v.optional(v.string()),
    source: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
});

export const updateTalentSchema = v.intersect([
    v.object({ id: v.pipe(v.string(), v.minLength(1)) }),
    createTalentSchema
]);

export const unifiedTalentSchema = v.object({
    talent: v.object({
        id: v.optional(v.string()),
        contactId: v.optional(v.string()),
        status: v.optional(v.picklist(["active", "inactive", "applicant"]), "applicant"),
        jobTitle: v.optional(v.string()),
        salaryExpectation: v.optional(v.string()),
        availabilityDate: v.optional(v.string()),
        onboardingStatus: v.optional(v.string()),
        resumeUrl: v.optional(v.string()),
        source: v.optional(v.string()),
        internalNotes: v.optional(v.string()),
    }),
    contact: v.object({
        id: v.optional(v.string()),
        displayName: v.pipe(v.string(), v.minLength(1)),
        givenName: v.optional(v.string()),
        familyName: v.optional(v.string()),
        birthday: v.optional(v.string()),
        company: v.optional(v.string()),
        role: v.optional(v.string()),
        department: v.optional(v.string()),
        notes: v.optional(v.string()),
        isPublic: v.optional(v.union([v.boolean(), v.string()])),
        emails: v.optional(v.array(v.omit(emailSchemaPure, ['id']))),
        phones: v.optional(v.array(v.omit(phoneSchemaPure, ['id']))),
        addresses: v.optional(v.array(v.omit(addressSchemaPure, ['id']))),
        relations: v.optional(v.array(v.object({ targetContactId: v.string(), relationType: v.string() }))),
        tags: v.optional(v.array(v.string())),
    }),
    // Helper JSON fields for the form
    emailsJson: v.optional(v.string()),
    phonesJson: v.optional(v.string()),
    relationsJson: v.optional(v.string()),
    tagsJson: v.optional(v.string()),
    addressesJson: v.optional(v.string()),
    locationIdsJson: v.optional(v.string()),
    linkedUserId: v.optional(v.string()),
});

export const timeOffRequestSchema = v.object({
    id: v.optional(v.string()),
    talentId: v.pipe(v.string(), v.minLength(1, "Talent is required")),
    type: v.picklist(["vacation", "sick", "other"]),
    status: v.optional(v.picklist(["pending", "approved", "rejected"]), "pending"),
    startDate: v.pipe(v.string(), v.minLength(1, "Start date is required")),
    endDate: v.pipe(v.string(), v.minLength(1, "End date is required")),
    reason: v.optional(v.string()),
});

export const timeOffBalanceSchema = v.object({
    id: v.optional(v.string()),
    talentId: v.pipe(v.string(), v.minLength(1)),
    year: v.number(),
    totalDays: v.number(),
    usedDays: v.optional(v.number(), 0),
    pendingDays: v.optional(v.number(), 0),
});
