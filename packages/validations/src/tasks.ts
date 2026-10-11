import * as v from 'valibot';

export const taskTypePicklist = v.picklist([
    'experience_step_increase',
    'tenure_anniversary',
    'condition_update_approval',
    'timesheet_approval',
    'probation_end',
    'contract_expiration',
    'profile_update',
    'correction',
    'manual',
]);

export type TaskType = v.InferOutput<typeof taskTypePicklist>;

export const taskStatusPicklist = v.picklist(['pending', 'completed', 'archived']);
export type TaskStatus = v.InferOutput<typeof taskStatusPicklist>;

export const taskTypeConfigSchema = v.object({
    id: v.optional(v.string()),
    taskType: v.pipe(v.string(), v.minLength(1, 'Task type is required')),
    name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
    description: v.optional(v.string()),
    leadTimeDays: v.pipe(v.number(), v.minValue(0, 'Lead time must be at least 0 days')),
    targetRoles: v.optional(v.array(v.string()), ['admin', 'hr_manager', 'top_management']),
    isEnabled: v.optional(v.boolean(), true),
    autoPromptDifferentialUpdate: v.optional(v.boolean(), true),
});

export type TaskTypeConfigInput = v.InferOutput<typeof taskTypeConfigSchema>;

export const updateTaskTypeConfigSchema = v.object({
    taskType: v.pipe(v.string(), v.minLength(1, 'Task type is required')),
    name: v.optional(v.string()),
    leadTimeDays: v.pipe(v.number(), v.minValue(0, 'Lead time must be positive')),
    isEnabled: v.optional(v.boolean(), true),
    targetRoles: v.optional(v.array(v.string())),
    autoPromptDifferentialUpdate: v.optional(v.boolean(), true),
});

export type UpdateTaskTypeConfigInput = v.InferOutput<typeof updateTaskTypeConfigSchema>;

export const issueDifferentialContractUpdateSchema = v.object({
    taskId: v.pipe(v.string(), v.minLength(1, 'Task ID is required')),
    contractId: v.pipe(v.string(), v.minLength(1, 'Contract ID is required')),
    talentId: v.pipe(v.string(), v.minLength(1, 'Talent ID is required')),
    effectiveDate: v.pipe(v.string(), v.minLength(1, 'Effective date is required')),
    newEntgeltgruppe: v.optional(v.string()),
    newStufe: v.pipe(v.number(), v.minValue(1, 'Step must be at least 1')),
    newWageAmount: v.pipe(v.number(), v.minValue(0, 'Wage must be positive')),
    notes: v.optional(v.string()),
    scheduleReport: v.optional(v.boolean(), false),
});

export type IssueDifferentialContractUpdateInput = v.InferOutput<typeof issueDifferentialContractUpdateSchema>;

export const taskFilterSchema = v.object({
    search: v.optional(v.string()),
    status: v.optional(v.picklist(['all', 'pending', 'completed', 'archived']), 'pending'),
    type: v.optional(v.string()),
    urgency: v.optional(v.picklist(['all', 'overdue', 'due_soon'])),
    page: v.optional(v.number(), 1),
    limit: v.optional(v.number(), 50),
});

export type TaskFilterInput = v.InferOutput<typeof taskFilterSchema>;

export const triggerMilestoneCheckSchema = v.object({
    force: v.optional(v.boolean(), false),
    period: v.optional(v.string()),
    leadTimeDaysOverride: v.optional(v.number()),
});

export type TriggerMilestoneCheckInput = v.InferOutput<typeof triggerMilestoneCheckSchema>;
