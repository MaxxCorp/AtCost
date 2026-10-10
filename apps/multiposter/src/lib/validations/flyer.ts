import * as v from 'valibot';

export const flyerDensitySchema = v.picklist(['compact', 'standard', 'detailed']);
export type FlyerDensity = v.InferOutput<typeof flyerDensitySchema>;

export const flyerItemInputSchema = v.object({
    id: v.string(),
    title: v.string(),
    description: v.optional(v.nullable(v.string())),
    startDateTime: v.optional(v.nullable(v.string())),
    endDateTime: v.optional(v.nullable(v.string())),
    type: v.picklist(['event', 'announcement']),
    locationNames: v.optional(v.array(v.string())),
    roomNames: v.optional(v.array(v.string()))
});
export type FlyerItemInput = v.InferOutput<typeof flyerItemInputSchema>;

export const summarizeFlyerSchema = v.object({
    kioskId: v.string(),
    targetDensity: v.optional(flyerDensitySchema, 'standard'),
    customInstructions: v.optional(v.string()),
    items: v.array(flyerItemInputSchema)
});
export type SummarizeFlyerInput = v.InferOutput<typeof summarizeFlyerSchema>;

export interface FlyerItemSummary {
    id: string;
    title: string;
    summary: string;
    highlight?: string;
}

export interface SummarizeFlyerResult {
    success: boolean;
    error?: string;
    fallback?: boolean;
    summaries?: Record<string, FlyerItemSummary>;
}
