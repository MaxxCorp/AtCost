import * as v from 'valibot';

export const processSeriesMigrationBatchSchema = v.object({
	operationId: v.string(),
	batchSize: v.optional(v.number(), 25)
});

export type ProcessSeriesMigrationBatchInput = v.InferOutput<typeof processSeriesMigrationBatchSchema>;
