import * as v from 'valibot';
import { query, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { db } from '@ac/db';
import {
	syncConfig as syncConfigTable,
	syncOperation as syncOperationTable,
	syncMapping as syncMappingTable,
	event as eventTable,
	announcement as announcementTable,
	campaign as campaignTable,
	emailCampaign as emailCampaignTable
} from '@ac/db';
import { eq, and, or, isNull, isNotNull, sql, inArray, count } from '@ac/db';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { processMigrationBatchSchema } from '$lib/validations/synchronizations';
import {
	createDefaultCampaignContent,
	type CampaignContent
} from '@ac/validations';

/**
 * Check if there is any legacy synchronization data requiring migration.
 */
export const checkMigrationStatus = query(async () => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'synchronizations');

	const [mappingRes] = await db
		.select({ count: count() })
		.from(syncMappingTable)
		.where(or(isNotNull(syncMappingTable.eventId), isNotNull(syncMappingTable.announcementId)));
	const syncMappings = Number(mappingRes?.count || 0);

	const [emailRes] = await db.select({ count: count() }).from(emailCampaignTable);
	const emailCampaigns = Number(emailRes?.count || 0);

	const [unlinkedRes] = await db
		.select({ count: count() })
		.from(eventTable)
		.where(and(isNull(eventTable.campaignId), or(isNotNull(eventTable.recurringEventId), isNotNull(eventTable.seriesId))));
	const unlinkedInstances = Number(unlinkedRes?.count || 0);

	// Check campaigns with legacy content (no version=1 or has syncIds array)
	const [legacyCampRes] = await db
		.select({ count: count() })
		.from(campaignTable)
		.where(
			sql`(${campaignTable.content} IS NOT NULL AND (${campaignTable.content}->>'version' IS NULL OR ${campaignTable.content} ? 'syncIds'))`
		);
	const legacyCampaigns = Number(legacyCampRes?.count || 0);

	const totalItems = syncMappings + emailCampaigns + unlinkedInstances + legacyCampaigns;
	const hasLegacyData = totalItems > 0;

	return {
		hasLegacyData,
		counts: {
			syncMappings,
			emailCampaigns,
			unlinkedInstances,
			legacyCampaigns
		},
		totalItems
	};
});

type MigrationTask =
	| { type: 'link_instances'; ids: string[] }
	| { type: 'migrate_campaign'; id: string }
	| { type: 'migrate_mapping'; id: string }
	| { type: 'migrate_email'; id: string };

/**
 * Start a migration process.
 * Compiles the queue of work and stores it in syncOperationTable for chunked execution.
 */
export const startMigration = command(async () => {
	const user = getAuthenticatedUser();
	ensureAccess(user, 'synchronizations');

	// Find any anchor sync config ID for the operation record
	const [anyConfig] = await db
		.select({ id: syncConfigTable.id })
		.from(syncConfigTable)
		.limit(1);

	if (!anyConfig) {
		error(400, 'Cannot run migration: No sync configurations exist in the database.');
	}

	const queue: MigrationTask[] = [];

	// 1. Unlinked instances
	const unlinkedInstances = await db
		.select({ id: eventTable.id })
		.from(eventTable)
		.where(and(isNull(eventTable.campaignId), or(isNotNull(eventTable.recurringEventId), isNotNull(eventTable.seriesId))));

	if (unlinkedInstances.length > 0) {
		const ids = unlinkedInstances.map((i) => i.id);
		// Group in chunks of 50
		for (let i = 0; i < ids.length; i += 50) {
			queue.push({ type: 'link_instances', ids: ids.slice(i, i + 50) });
		}
	}

	// 2. Legacy campaigns
	const legacyCampaigns = await db
		.select({ id: campaignTable.id })
		.from(campaignTable)
		.where(
			sql`(${campaignTable.content} IS NOT NULL AND (${campaignTable.content}->>'version' IS NULL OR ${campaignTable.content} ? 'syncIds'))`
		);

	for (const camp of legacyCampaigns) {
		queue.push({ type: 'migrate_campaign', id: camp.id });
	}

	// 3. Sync mappings (events and announcements only)
	const mappings = await db
		.select({ id: syncMappingTable.id })
		.from(syncMappingTable)
		.where(or(isNotNull(syncMappingTable.eventId), isNotNull(syncMappingTable.announcementId)));
	for (const m of mappings) {
		queue.push({ type: 'migrate_mapping', id: m.id });
	}

	// 4. Email campaigns
	const emails = await db.select({ id: emailCampaignTable.id }).from(emailCampaignTable);
	for (const e of emails) {
		queue.push({ type: 'migrate_email', id: e.id });
	}

	if (queue.length === 0) {
		return { operationId: '', total: 0, done: true };
	}

	const [op] = await db
		.insert(syncOperationTable)
		.values({
			syncConfigId: anyConfig.id,
			operation: 'campaign_migration',
			status: 'pending',
			startedAt: new Date(),
			results: {
				total: queue.length,
				processed: 0,
				errors: [],
				queue
			}
		})
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
export const processMigrationBatch = command(
	processMigrationBatchSchema,
	async (input) => {
		const user = getAuthenticatedUser();
		ensureAccess(user, 'synchronizations');

		const [op] = await db
			.select()
			.from(syncOperationTable)
			.where(eq(syncOperationTable.id, input.operationId));

		if (!op) {
			error(404, 'Migration operation not found');
		}

		const results = (op.results as any) || {};
		const queue: MigrationTask[] = results.queue || [];
		const total = Number(results.total || queue.length);
		let processed = Number(results.processed || 0);
		const errors: any[] = results.errors || [];

		if (op.status === 'completed' || processed >= total) {
			return { done: true, processed: total, total, errors };
		}

		const batchSize = input.batchSize || 25;
		const batch = queue.slice(processed, processed + batchSize);

		for (const task of batch) {
			try {
				if (task.type === 'link_instances') {
					// Link instance to master event campaign
					const instances = await db
						.select({
							id: eventTable.id,
							recurringEventId: eventTable.recurringEventId,
							seriesId: eventTable.seriesId
						})
						.from(eventTable)
						.where(inArray(eventTable.id, task.ids));

					for (const inst of instances) {
						let master: any = null;
						if (inst.recurringEventId) {
							[master] = await db
								.select({ id: eventTable.id, campaignId: eventTable.campaignId, userId: eventTable.userId, summary: eventTable.summary })
								.from(eventTable)
								.where(eq(eventTable.id, inst.recurringEventId));
						} else if (inst.seriesId) {
							[master] = await db
								.select({ id: eventTable.id, campaignId: eventTable.campaignId, userId: eventTable.userId, summary: eventTable.summary })
								.from(eventTable)
								.where(and(eq(eventTable.seriesId, inst.seriesId), isNull(eventTable.recurringEventId)));
						}

						if (master) {
							let masterCampaignId = master.campaignId;
							if (!masterCampaignId) {
								const [newCamp] = await db
									.insert(campaignTable)
									.values({
										userId: master.userId,
										name: `Campaign for ${master.summary}`,
										content: createDefaultCampaignContent()
									})
									.returning();
								masterCampaignId = newCamp.id;
								await db
									.update(eventTable)
									.set({ campaignId: masterCampaignId })
									.where(eq(eventTable.id, master.id));
							}
							await db
								.update(eventTable)
								.set({ campaignId: masterCampaignId })
								.where(eq(eventTable.id, inst.id));

							// Ensure instance is in campaign content items
							const [camp] = await db.select().from(campaignTable).where(eq(campaignTable.id, masterCampaignId));
							if (camp) {
								const cContent: CampaignContent = (camp.content as any)?.version === 1
									? (camp.content as any)
									: createDefaultCampaignContent();
								if (!cContent.items) cContent.items = {};
								if (!cContent.items[inst.id]) {
									cContent.items[inst.id] = { entityType: 'event', syncs: {} };
									await db.update(campaignTable).set({ content: cContent, updatedAt: new Date() }).where(eq(campaignTable.id, masterCampaignId));
								}
							}
						}
					}
				} else if (task.type === 'migrate_campaign') {
					const [camp] = await db
						.select()
						.from(campaignTable)
						.where(eq(campaignTable.id, task.id));

					if (camp) {
						const rawContent: any = camp.content || {};
						if (rawContent.version !== 1) {
							const legacySyncIds: string[] = Array.isArray(rawContent.syncIds)
								? rawContent.syncIds
								: [];
							const newContent: CampaignContent = createDefaultCampaignContent(legacySyncIds);

							await db
								.update(campaignTable)
								.set({
									content: newContent,
									updatedAt: new Date()
								})
								.where(eq(campaignTable.id, camp.id));
						}
					}
				} else if (task.type === 'migrate_mapping') {
					const [mapping] = await db
						.select()
						.from(syncMappingTable)
						.where(eq(syncMappingTable.id, task.id));

					if (mapping) {
						const itemId = mapping.eventId || mapping.announcementId;
						const entityType: 'event' | 'announcement' = mapping.eventId ? 'event' : 'announcement';

						if (itemId) {
							const table = entityType === 'event' ? eventTable : announcementTable;
							const [entityRow] = await db
								.select({ id: table.id, campaignId: table.campaignId, userId: table.userId })
								.from(table)
								.where(eq(table.id, itemId));

							if (entityRow) {
								let campId = entityRow.campaignId;
								let currentContent: CampaignContent;

								if (!campId) {
									currentContent = createDefaultCampaignContent([mapping.syncConfigId]);
									const [newCamp] = await db
										.insert(campaignTable)
										.values({
											userId: entityRow.userId,
											name: `Campaign for ${entityType} ${itemId}`,
											content: currentContent
										})
										.returning();
									campId = newCamp.id;
									await db
										.update(table)
										.set({ campaignId: campId } as any)
										.where(eq(table.id, itemId));
								} else {
									const [camp] = await db
										.select()
										.from(campaignTable)
										.where(eq(campaignTable.id, campId));

									const rawContent = (camp?.content as any) || {};
									if (rawContent.version === 1) {
										currentContent = rawContent;
									} else {
										const legacySyncIds = Array.isArray(rawContent.syncIds) ? rawContent.syncIds : [];
										currentContent = createDefaultCampaignContent(legacySyncIds);
									}
								}

								// Populate sync execution state
								currentContent.targets[mapping.syncConfigId] = { enabled: true };
								if (!currentContent.items) currentContent.items = {};
								if (!currentContent.items[itemId]) {
									currentContent.items[itemId] = { entityType, syncs: {} };
								}
								currentContent.items[itemId].syncs[mapping.syncConfigId] = {
									status: 'synced',
									externalId: mapping.externalId,
									etag: mapping.etag ?? undefined,
									lastSyncedAt: mapping.lastSyncedAt
										? mapping.lastSyncedAt.toISOString()
										: new Date().toISOString(),
									metadata: (mapping.metadata as any) ?? undefined
								};

								if (!currentContent.externalIds) currentContent.externalIds = {};
								currentContent.externalIds[mapping.externalId] = {
									itemId,
									configId: mapping.syncConfigId
								};

								await db
									.update(campaignTable)
									.set({ content: currentContent, updatedAt: new Date() })
									.where(eq(campaignTable.id, campId));
							}
						}

						// Delete migrated sync mapping
						await db.delete(syncMappingTable).where(eq(syncMappingTable.id, mapping.id));
					}
				} else if (task.type === 'migrate_email') {
					const [emailRow] = await db
						.select()
						.from(emailCampaignTable)
						.where(eq(emailCampaignTable.id, task.id));

					if (emailRow) {
						const itemId = emailRow.eventId || emailRow.announcementId;
						const entityType: 'event' | 'announcement' = emailRow.eventId ? 'event' : 'announcement';

						if (itemId) {
							const table = entityType === 'event' ? eventTable : announcementTable;
							const [entityRow] = await db
								.select({ id: table.id, campaignId: table.campaignId, userId: table.userId })
								.from(table)
								.where(eq(table.id, itemId));

							if (entityRow && entityRow.campaignId) {
								const [camp] = await db
									.select()
									.from(campaignTable)
									.where(eq(campaignTable.id, entityRow.campaignId));

								if (camp) {
									const currentContent: CampaignContent =
										(camp.content as any)?.version === 1
											? (camp.content as any)
											: createDefaultCampaignContent();

									if (!currentContent.items) currentContent.items = {};
									if (!currentContent.items[itemId]) {
										currentContent.items[itemId] = { entityType, syncs: {} };
									}
									const existingSync = currentContent.items[itemId].syncs[emailRow.syncConfigId] || {
										status: 'synced'
									};
									existingSync.metadata = {
										...(existingSync.metadata || {}),
										brevoCampaignId: emailRow.brevoCampaignId,
										eventSummary: emailRow.eventSummary,
										sentAt: emailRow.sentAt.toISOString(),
										recipientCount: emailRow.recipientCount,
										...(emailRow.metadata as any || {})
									};
									currentContent.items[itemId].syncs[emailRow.syncConfigId] = existingSync;

									await db
										.update(campaignTable)
										.set({ content: currentContent, updatedAt: new Date() })
										.where(eq(campaignTable.id, entityRow.campaignId));
								}
							}
						}

						// Delete migrated email campaign
						await db.delete(emailCampaignTable).where(eq(emailCampaignTable.id, emailRow.id));
					}
				}
			} catch (err: any) {
				console.error(`[Migration] Error processing task:`, task, err);
				errors.push({ task, error: err?.message || String(err) });
			}
		}

		processed += batch.length;
		const done = processed >= total;

		if (done) {
			await db
				.update(syncOperationTable)
				.set({
					status: errors.length > 0 && processed === 0 ? 'failed' : 'completed',
					completedAt: new Date(),
					results: { total, processed, errors, queue: [] }
				})
				.where(eq(syncOperationTable.id, input.operationId));
		} else {
			await db
				.update(syncOperationTable)
				.set({
					results: { total, processed, errors, queue }
				})
				.where(eq(syncOperationTable.id, input.operationId));
		}

		return { done, processed, total, errors };
	}
);
