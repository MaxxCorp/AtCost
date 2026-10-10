import { query, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { db } from '@ac/db';
import {
	syncConfig as syncConfigTable,
	syncOperation as syncOperationTable,
	event as eventTable,
	recurringSeries as recurringSeriesTable,
	campaign as campaignTable,
	kiosk as kioskTable
} from '@ac/db';
import { eq, and, isNotNull, inArray, count, sql } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { processSeriesMigrationBatchSchema } from '#lib/validations/series-migration.js';
import { invalidateEvent, invalidateAllKioskViews } from '#lib/server/cache/index.js';
import { listEvents } from './list.remote';

type MigrationTask =
	| { type: 'migrate_master'; eventId: string }
	| { type: 'prune_instances'; ids: string[] }
	| { type: 'migrate_kiosks' }
	| { type: 'cleanup_series_tables' };

/**
 * Check if there is any legacy event series data requiring migration.
 */
export const checkSeriesMigrationStatus = query(async () => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'events');

	const [seriesRes] = await db
		.select({ count: count() })
		.from(recurringSeriesTable);
	const seriesRows = Number(seriesRes?.count || 0);

	const [eventsWithSeriesIdRes] = await db
		.select({ count: count() })
		.from(eventTable)
		.where(isNotNull(eventTable.seriesId));
	const legacyEventsWithSeriesId = Number(eventsWithSeriesIdRes?.count || 0);

	const [redundantInstancesRes] = await db
		.select({ count: count() })
		.from(eventTable)
		.where(and(isNotNull(eventTable.recurringEventId), eq(eventTable.isException, false)));
	const redundantInstances = Number(redundantInstancesRes?.count || 0);

	const allKiosks = await db
		.select({ id: kioskTable.id, excludedTags: kioskTable.excludedTags })
		.from(kioskTable);
	const legacyKiosks = allKiosks.filter((k) =>
		Array.isArray(k.excludedTags) && k.excludedTags.includes('Series')
	).length;

	const totalItems = seriesRows + legacyEventsWithSeriesId + redundantInstances + (legacyKiosks > 0 ? 1 : 0);
	const hasLegacyData = totalItems > 0;

	return {
		hasLegacyData,
		counts: {
			seriesRows,
			legacyEventsWithSeriesId,
			redundantInstances,
			legacyKiosks
		},
		totalItems
	};
});

/**
 * Start event series migration.
 * Compiles the queue of work and stores it in syncOperationTable for chunked execution.
 */
export const startSeriesMigration = command(async () => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'events');

	// Find an anchor sync config ID for the operation record, or create a system one if needed
	let [anyConfig] = await db
		.select({ id: syncConfigTable.id })
		.from(syncConfigTable)
		.limit(1);

	if (!anyConfig) {
		const [createdConfig] = await db.insert(syncConfigTable).values({
			userId: user.id,
			name: 'System Internal Config',
			providerType: 'google-calendar',
			direction: 'bidirectional',
			enabled: false,
			status: 'inactive'
		} as any).returning({ id: syncConfigTable.id });
		anyConfig = createdConfig;
	}

	const queue: MigrationTask[] = [];

	// 1. Identify all master events with seriesId
	const mastersWithSeriesId = await db
		.select({ id: eventTable.id })
		.from(eventTable)
		.where(and(isNotNull(eventTable.seriesId), eq(eventTable.isException, false)));

	for (const m of mastersWithSeriesId) {
		queue.push({ type: 'migrate_master', eventId: m.id });
	}

	// 2. Identify redundant physical instances
	const redundantInstances = await db
		.select({ id: eventTable.id })
		.from(eventTable)
		.where(and(isNotNull(eventTable.recurringEventId), eq(eventTable.isException, false)));

	if (redundantInstances.length > 0) {
		const ids = redundantInstances.map((i) => i.id);
		// Group in batches of 25 for safe serverless execution
		for (let i = 0; i < ids.length; i += 25) {
			queue.push({ type: 'prune_instances', ids: ids.slice(i, i + 25) });
		}
	}

	// 3. Migrate kiosk configurations & purge kiosk caches
	queue.push({ type: 'migrate_kiosks' });

	// 4. Final cleanup task for recurringSeries table and remaining pointers
	queue.push({ type: 'cleanup_series_tables' });

	if (queue.length === 0) {
		return { operationId: '', total: 0, done: true };
	}

	const [op] = await db
		.insert(syncOperationTable)
		.values({
			syncConfigId: anyConfig.id,
			operation: 'series_migration',
			status: 'pending',
			startedAt: new Date(),
			results: {
				total: queue.length,
				processed: 0,
				errors: [],
				queue
			}
		} as any)
		.returning({ id: syncOperationTable.id });

	return {
		operationId: op.id,
		total: queue.length,
		done: false
	};
});

/**
 * Process a batch of migration tasks within serverless timeout limits.
 */
export const processSeriesMigrationBatch = command(
	processSeriesMigrationBatchSchema,
	async ({ operationId, batchSize = 25 }) => {
		const user = getAuthenticatedUser();
		ensureAccess(user, 'events');

		const [opRow] = await db
			.select()
			.from(syncOperationTable)
			.where(eq(syncOperationTable.id, operationId));

		if (!opRow) {
			error(404, 'Series migration operation not found');
		}

		const results = (opRow.results as any) || {};
		const queue: MigrationTask[] = results.queue || [];
		const total = Number(results.total || queue.length);
		let processed = Number(results.processed || 0);
		const errors = (results.errors as any[]) || [];

		if (opRow.status === 'completed' || processed >= total) {
			return { done: true, processed: total, total, errors };
		}

		const batch = queue.slice(processed, processed + batchSize);

		for (const task of batch) {
			try {
				if (task.type === 'migrate_master') {
					const [evt] = await db
						.select()
						.from(eventTable)
						.where(eq(eventTable.id, task.eventId));

					if (evt) {
						let rrule = evt.recurrence && Array.isArray(evt.recurrence) ? evt.recurrence[0] : null;

						if (!rrule && evt.seriesId) {
							const [series] = await db
								.select()
								.from(recurringSeriesTable)
								.where(eq(recurringSeriesTable.id, evt.seriesId));
							if (series?.rrule) {
								rrule = series.rrule;
							}
						}

						await db
							.update(eventTable)
							.set({
								recurrence: rrule ? [rrule] : evt.recurrence,
								seriesId: null,
								updatedAt: new Date()
							})
							.where(eq(eventTable.id, task.eventId));
					}
				} else if (task.type === 'prune_instances') {
					const instances = await db
						.select({
							id: eventTable.id,
							recurringEventId: eventTable.recurringEventId,
							status: eventTable.status,
							startDateTime: eventTable.startDateTime,
							originalStartTime: eventTable.originalStartTime
						})
						.from(eventTable)
						.where(inArray(eventTable.id, task.ids));

					// If any instance was cancelled, preserve the cancellation by adding its slot to master's exdates
					for (const inst of instances) {
						if (inst.status === 'cancelled' && inst.recurringEventId && inst.startDateTime) {
							const [master] = await db
								.select()
								.from(eventTable)
								.where(eq(eventTable.id, inst.recurringEventId));

							if (master) {
								const dateIso = inst.originalStartTime && typeof inst.originalStartTime === 'object' && 'dateTime' in (inst.originalStartTime as any)
									? (inst.originalStartTime as any).dateTime
									: inst.startDateTime.toISOString();

								const existingExdates: string[] = Array.isArray(master.exdates) ? (master.exdates as string[]) : [];
								if (!existingExdates.includes(dateIso)) {
									await db
										.update(eventTable)
										.set({ exdates: [...existingExdates, dateIso] })
										.where(eq(eventTable.id, master.id));
								}
							}
						}
					}

					// Delete redundant instance rows (cascade deletes junction tables)
					await db.delete(eventTable).where(inArray(eventTable.id, task.ids));
				} else if (task.type === 'migrate_kiosks') {
					const kiosks = await db.select().from(kioskTable);

					for (const k of kiosks) {
						let changed = false;
						let excludedTags = Array.isArray(k.excludedTags) ? [...k.excludedTags] : [];

						// Remove legacy 'Series' tag exclusion so projected series flow smoothly into kiosk
						if (excludedTags.includes('Series')) {
							excludedTags = excludedTags.filter((t) => t !== 'Series');
							changed = true;
						}

						if (changed) {
							await db
								.update(kioskTable)
								.set({
									excludedTags,
									updatedAt: new Date()
								})
								.where(eq(kioskTable.id, k.id));
						}
					}

					// Invalidate all kiosk view caches so kiosks immediately rebuild with projected series
					await invalidateAllKioskViews();
				} else if (task.type === 'cleanup_series_tables') {
					// Set seriesId = null across any remaining events
					await db
						.update(eventTable)
						.set({ seriesId: null })
						.where(isNotNull(eventTable.seriesId));

					// Delete all rows from recurringSeries
					await db.delete(recurringSeriesTable);
				}
			} catch (err: any) {
				console.error(`[SeriesMigration] Error processing task:`, task, err);
				errors.push({ task, error: err?.message || String(err) });
			}
		}

		processed += batch.length;
		const done = processed >= total;

		if (done) {
			await db
				.update(syncOperationTable)
				.set({
					status: errors.length > 0 ? 'completed' : 'completed',
					completedAt: new Date(),
					error: errors.length > 0 ? JSON.stringify(errors) : null,
					results: {
						total,
						processed,
						errors,
						queue: []
					}
				})
				.where(eq(syncOperationTable.id, operationId));

			await invalidateEvent();
			await listEvents().refresh();
		} else {
			await db
				.update(syncOperationTable)
				.set({
					results: {
						total,
						processed,
						errors,
						queue
					}
				})
				.where(eq(syncOperationTable.id, operationId));
		}

		return {
			done,
			processed,
			total,
			errors
		};
	}
);
