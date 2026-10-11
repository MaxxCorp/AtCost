import * as v from 'valibot';

export const hmoRateItemSchema = v.object({
    name: v.string(),
    code: v.optional(v.string()),
    additionalContributionPercent: v.number(),
});

export type HmoRateItem = v.InferOutput<typeof hmoRateItemSchema>;

export const changeDiffItemSchema = v.object({
    field: v.string(),
    oldValue: v.any(),
    newValue: v.any(),
    unit: v.optional(v.string()),
});

export type ChangeDiffItem = v.InferOutput<typeof changeDiffItemSchema>;

export const socialInsuranceConditionSchema = v.object({
    id: v.optional(v.string()),
    jurisdiction: v.optional(v.string(), 'DE'),
    name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
    version: v.optional(v.number(), 1),
    effectivePeriod: v.pipe(v.string(), v.minLength(7, 'Period must be in YYYY-MM format')),
    effectiveDate: v.optional(v.union([v.string(), v.date()])),
    status: v.optional(
        v.picklist(['pending_review', 'approved', 'superseded', 'rejected']),
        'pending_review'
    ),
    bbgKvPvMonthly: v.optional(v.number(), 5812.50),
    bbgRvAvMonthly: v.optional(v.number(), 8450.00),
    minijobLimit: v.optional(v.number(), 538.00),
    rvRateTotal: v.optional(v.number(), 0.186),
    rvRateHalf: v.optional(v.number(), 0.093),
    avRateTotal: v.optional(v.number(), 0.026),
    avRateHalf: v.optional(v.number(), 0.013),
    kvBaseRateHalf: v.optional(v.number(), 0.073),
    pvBaseRateAn: v.optional(v.number(), 0.022),
    pvBaseRateAg: v.optional(v.number(), 0.018),
    pvChildlessSurcharge: v.optional(v.number(), 0.006),
    u1Rate: v.optional(v.number(), 0.015),
    u2Rate: v.optional(v.number(), 0.0045),
    insolvenzRate: v.optional(v.number(), 0.0006),
    hmoRates: v.optional(v.array(hmoRateItemSchema)),
    source: v.optional(v.string(), 'gkv_spitzenverband_bmas'),
    changeSummary: v.optional(v.string()),
    changesDiff: v.optional(v.array(changeDiffItemSchema)),
    approvedAt: v.optional(v.union([v.string(), v.date()])),
    approvedByUserId: v.optional(v.string()),
    approvedByUserName: v.optional(v.string()),
    rejectedAt: v.optional(v.union([v.string(), v.date()])),
    rejectedByUserId: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
});

export type SocialInsuranceConditionInput = v.InferOutput<typeof socialInsuranceConditionSchema>;

export const unionContractConditionSchema = v.object({
    id: v.optional(v.string()),
    frameworkId: v.optional(v.nullable(v.string())),
    tariffCode: v.pipe(v.string(), v.minLength(1, 'Tariff code is required')),
    name: v.pipe(v.string(), v.minLength(1, 'Tariff name is required')),
    version: v.optional(v.number(), 1),
    effectivePeriod: v.pipe(v.string(), v.minLength(7, 'Period must be in YYYY-MM format')),
    effectiveDate: v.optional(v.union([v.string(), v.date()])),
    status: v.optional(
        v.picklist(['pending_review', 'approved', 'superseded', 'rejected']),
        'pending_review'
    ),
    wageGrid: v.optional(v.record(v.string(), v.record(v.string(), v.number()))),
    allowances: v.optional(v.record(v.string(), v.any())),
    surcharges: v.optional(v.record(v.string(), v.any())),
    stepProgressionRules: v.optional(v.record(v.string(), v.number())),
    tenureBenefits: v.optional(v.array(v.object({
        years: v.number(),
        label: v.string(),
        bonus: v.optional(v.number()),
        specialLeaveDays: v.optional(v.number()),
    }))),
    source: v.optional(v.string(), 'tarifregister_verdi'),
    changeSummary: v.optional(v.string()),
    changesDiff: v.optional(v.array(changeDiffItemSchema)),
    approvedAt: v.optional(v.union([v.string(), v.date()])),
    approvedByUserId: v.optional(v.string()),
    approvedByUserName: v.optional(v.string()),
    rejectedAt: v.optional(v.union([v.string(), v.date()])),
    rejectedByUserId: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
});

export type UnionContractConditionInput = v.InferOutput<typeof unionContractConditionSchema>;

export const approveConditionSchema = v.object({
    id: v.pipe(v.string(), v.minLength(1, 'Condition ID is required')),
    type: v.picklist(['social_insurance', 'union_contract']),
    taskId: v.optional(v.string()),
});

export type ApproveConditionInput = v.InferOutput<typeof approveConditionSchema>;

export const rejectConditionSchema = v.object({
    id: v.pipe(v.string(), v.minLength(1, 'Condition ID is required')),
    type: v.picklist(['social_insurance', 'union_contract']),
    reason: v.optional(v.string()),
    taskId: v.optional(v.string()),
});

export type RejectConditionInput = v.InferOutput<typeof rejectConditionSchema>;

export const syncConditionsSchema = v.object({
    force: v.optional(v.boolean(), false),
    period: v.optional(v.string()),
    simulateChange: v.optional(v.boolean(), false),
});

export type SyncConditionsInput = v.InferOutput<typeof syncConditionsSchema>;
