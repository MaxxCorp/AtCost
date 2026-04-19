import * as v from "valibot";

export const contractPaginationSchema = v.optional(v.object({
    page: v.optional(v.number(), 1),
    limit: v.optional(v.number(), 50),
    search: v.optional(v.string(), ''),
    talentId: v.optional(v.string())
}));

export const contractFrameworkSchema = v.object({
    id: v.optional(v.string()),
    name: v.pipe(v.string(), v.minLength(1, "Name is required")),
    description: v.optional(v.string()),
});

export const contractSchema = v.pipe(
    v.object({
        id: v.optional(v.string()),
        talentId: v.pipe(v.string(), v.minLength(1, "Talent is required")),
        startDate: v.pipe(v.string(), v.minLength(1, "Start date is required")),
        endDate: v.optional(v.string()),
        probationPeriodMonths: v.optional(v.number()),
        workHoursPerDay: v.optional(v.number()),
        workHoursPerWeek: v.optional(v.number()),
        workHoursPerMonth: v.optional(v.number()),
        workHoursPerYear: v.optional(v.number()),
        wageType: v.picklist(["hourly", "monthly"]),
        wageAmount: v.optional(v.number()),
        entgeltgruppe: v.optional(v.string()),
        erfahrungsstufe: v.optional(v.number()),
        specialPaymentRules: v.optional(v.any()), // Can hold anything, like { overtime: true, weekend: false }
        yearlyBonus: v.optional(v.string()),
        holidayAllotmentDays: v.optional(v.number()),
        frameworkIds: v.optional(v.array(v.string())), // Used on the UI to send multiple framework IDs
    }),
    v.forward(v.partialCheck(
        [['workHoursPerDay'], ['workHoursPerWeek'], ['workHoursPerMonth'], ['workHoursPerYear']],
        (input: any) => {
            return (
                typeof input.workHoursPerDay === 'number' ||
                typeof input.workHoursPerWeek === 'number' ||
                typeof input.workHoursPerMonth === 'number' ||
                typeof input.workHoursPerYear === 'number'
            );
        }, "At least one working hour field must be configured"), ["workHoursPerDay"])
);
