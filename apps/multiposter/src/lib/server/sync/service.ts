import type {
	SyncProvider,
	SyncConfig,
	SyncMapping,
	ExternalEvent,
	SyncResult,
	SyncDirection,
	ProviderType
} from './types';
import { db } from '@ac/db';
import {
	syncConfig as syncConfigTable,
	syncOperation as syncOperationTable,
	syncMapping as syncMappingTable,
	webhookSubscription as webhookSubscriptionTable,
	event as eventTable,
	announcement as announcementTable,
	announcementLocation as announcementLocation,
	announcementTag as announcementTag,
	eventContact as eventContactTable,
	tag as tagTable,
	contactTag as contactTagTable,
	user as userTable,
	contactEmail as contactEmailTable,
	location as locationTable,
	eventLocation as eventLocationTable,
	eventTag as eventTag,
	recurringSeries as recurringSeries,
	campaign as campaignTable,
	emailCampaign as emailCampaignTable,
	eventResource as eventResourceTable,
	resource as resourceTable
} from '@ac/db';
import { getEntityContacts } from '../contacts';
import { resolveEventContact, isEmployeeContact } from '../contact-resolution';
import { eq, and, isNull, lt, gt, gte, lte, or, inArray, desc, sql } from '@ac/db';
import {
	getCampaignTargetIds,
	getItemSyncState,
	createDefaultCampaignContent,
	type CampaignContent
} from '@ac/validations';
import { GoogleCalendarProvider } from './providers/google-calendar';
import { MicrosoftCalendarProvider } from './providers/microsoft-calendar';
import { BerlinDeMainCalendarProvider } from './providers/berlin-de-main-calendar';
import { BerlinDeMhCalendarProvider } from './providers/berlin-de-mh-calendar';
import { WpTheEventsCalendarProvider } from './providers/wp-the-events-calendar';
import { EventbriteProvider } from './providers/eventbrite';
import { MeetupProvider } from './providers/meetup';
import { SeniorennetzBerlinProvider } from './providers/seniorennetz-berlin';
import { BewegungsatlasBerlinProvider } from './providers/bewegungsatlas-berlin';
import { EmailProvider } from './providers/email';
import { NebenanDeProvider } from './providers/nebenan-de';
import { InstagramProvider } from './providers/instagram';
import { env } from '$env/dynamic/private';
import { publishEventChange } from '../realtime';

/**
 * Central sync service orchestrator
 * Manages provider instances and coordinates sync operations
 */
export class SyncService {
	private providers = new Map<ProviderType, new () => SyncProvider>();

	constructor() {
		// Register built-in providers
		this.registerProvider('google-calendar', GoogleCalendarProvider);
		this.registerProvider('microsoft-calendar', MicrosoftCalendarProvider);
		this.registerProvider('berlin-de-main-calendar', BerlinDeMainCalendarProvider);
		this.registerProvider('berlin-de-mh-calendar', BerlinDeMhCalendarProvider);
		this.registerProvider('wp-the-events-calendar', WpTheEventsCalendarProvider);
		this.registerProvider('eventbrite', EventbriteProvider);
		this.registerProvider('meetup', MeetupProvider);
		this.registerProvider('seniorennetz-berlin', SeniorennetzBerlinProvider);
		this.registerProvider('bewegungsatlas-berlin', BewegungsatlasBerlinProvider);
		this.registerProvider('email', EmailProvider);
		this.registerProvider('nebenan-de', NebenanDeProvider);
		this.registerProvider('instagram', InstagramProvider);
	}

	/**
	 * Register a new sync provider
	 */
	registerProvider(type: ProviderType, providerClass: new () => SyncProvider): void {
		this.providers.set(type, providerClass);
	}

	/**
	 * Get provider instance for a sync config
	 */
	private async getProviderInstance(config: SyncConfig): Promise<SyncProvider> {
		const ProviderClass = this.providers.get(config.providerType);
		if (!ProviderClass) {
			throw new Error(`Unknown provider type: ${config.providerType}`);
		}

		const provider = new ProviderClass();
		await provider.initialize(config);

		return provider;
	}

	/**
	 * Convert database row to SyncConfig type
	 */
	private rowToConfig(row: typeof syncConfigTable.$inferSelect): SyncConfig {
		return {
			id: row.id,
			userId: row.userId,
			providerId: row.providerId ?? '',
			providerType: row.providerType as ProviderType,
			direction: row.direction as SyncDirection,
			enabled: row.enabled,
			credentials: row.credentials as Record<string, any> | undefined,
			settings: row.settings as Record<string, any> | undefined,
			lastSyncAt: row.lastSyncAt ?? undefined,
			nextSyncAt: row.nextSyncAt ?? undefined,
			syncToken: row.syncToken ?? undefined,
			webhookId: row.webhookId ?? undefined,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt
		};
	}

	/**
	 * Sync events for a specific configuration
	 * Handles bidirectional sync (pull from provider, push local changes)
	 */
	/**
	 * Sync events for a specific configuration
	 * Handles bidirectional sync (pull from provider, push local changes)
	 */
	async syncEvents(configId: string): Promise<SyncResult> {
		const startRes = await this.startBulkSync(configId);
		let done = startRes.done;
		let lastBatchRes: any = null;

		while (!done) {
			lastBatchRes = await this.processBulkSyncBatch(configId, startRes.operationId, 25);
			done = lastBatchRes.done;
		}

		return {
			success: (lastBatchRes?.errors?.length || 0) === 0,
			pulled: startRes.pulled,
			pushed: lastBatchRes?.pushed || 0,
			errors: lastBatchRes?.errors || []
		};
	}

	/**
	 * Start a bulk sync process for a configuration.
	 * Executes pull if applicable, compiles the full queue of eligible events (handling series and instances)
	 * and announcements, and creates the operation record for chunked batch execution.
	 */
	async startBulkSync(configId: string): Promise<{ operationId: string; total: number; pulled: number; done: boolean }> {
		const [configRow] = await db
			.select()
			.from(syncConfigTable)
			.where(and(eq(syncConfigTable.id, configId), eq(syncConfigTable.enabled, true)));

		if (!configRow) {
			console.error(`[SyncService] Sync config not found or disabled: ${configId}`);
			throw new Error(`Sync config not found or disabled: ${configId}`);
		}

		const config = this.rowToConfig(configRow);
		const provider = await this.getProviderInstance(config);

		let pulled = 0;
		const errors: any[] = [];

		// Pull events from provider if applicable
		if (config.direction === 'pull' || config.direction === 'bidirectional') {
			try {
				const pullResult = await this.pullFromProvider(config, provider);
				pulled = pullResult.pulled;
				errors.push(...pullResult.errors);
			} catch (e: any) {
				console.error(`[SyncService] Pull operation failed:`, e);
				errors.push({ message: `Pull failed: ${e.message}` });
			}
		}

		// If direction is pull-only, no push is needed
		if (config.direction === 'pull') {
			const [op] = await db.insert(syncOperationTable).values({
				syncConfigId: configId,
				operation: 'pull',
				status: errors.length > 0 ? 'failed' : 'completed',
				entityType: 'event',
				startedAt: new Date(),
				completedAt: new Date(),
				error: errors.length > 0 ? JSON.stringify(errors) : null,
				results: { total: 0, processed: 0, pushed: 0, pulled, errors }
			}).returning({ id: syncOperationTable.id });

			await db.update(syncConfigTable).set({
				lastSyncAt: new Date(),
				nextSyncAt: this.calculateNextSync(config)
			}).where(eq(syncConfigTable.id, configId));

			return { operationId: op.id, total: 0, pulled, done: true };
		}

		// Fetch existing mappings for this config
		const existingMappings = await db
			.select()
			.from(syncMappingTable)
			.where(eq(syncMappingTable.syncConfigId, config.id));

		const eventMappingMap = new Map<string, typeof syncMappingTable.$inferSelect>();
		const announcementMappingMap = new Map<string, typeof syncMappingTable.$inferSelect>();
		for (const m of existingMappings) {
			if (m.eventId) eventMappingMap.set(m.eventId, m);
			if (m.announcementId) announcementMappingMap.set(m.announcementId, m);
		}

		type SyncQueueItem = {
			id: string;
			entityType: 'event' | 'announcement';
			action: 'sync' | 'unpublish';
			mappingId?: string;
			externalId?: string;
		};

		const itemsToSync: SyncQueueItem[] = [];

		// 1. Process Events (if provider supports events)
		const processedEventIds = new Set<string>();
		if (provider.supportedEntityTypes.includes('event')) {
			const allEventsWithCampaign = await db
				.select({
					event: eventTable,
					campaign: campaignTable
				})
				.from(eventTable)
				.leftJoin(campaignTable, eq(eventTable.campaignId, campaignTable.id));

			// Detect instances needing master event campaign (healing bit rot)
			const instancesNeedingMaster = allEventsWithCampaign.filter(
				r => !r.campaign && (r.event.recurringEventId || r.event.seriesId)
			);

			const masterCampaignMap = new Map<string, typeof campaignTable.$inferSelect>();
			const seriesCampaignMap = new Map<string, typeof campaignTable.$inferSelect>();

			if (instancesNeedingMaster.length > 0) {
				const masterIds = Array.from(new Set(
					instancesNeedingMaster.map(r => r.event.recurringEventId).filter(Boolean) as string[]
				));
				const seriesIds = Array.from(new Set(
					instancesNeedingMaster.map(r => r.event.seriesId).filter(Boolean) as string[]
				));

				if (masterIds.length > 0) {
					const masterEvents = await db
						.select({
							event: eventTable,
							campaign: campaignTable
						})
						.from(eventTable)
						.leftJoin(campaignTable, eq(eventTable.campaignId, campaignTable.id))
						.where(inArray(eventTable.id, masterIds));

					for (const m of masterEvents) {
						if (m.campaign) masterCampaignMap.set(m.event.id, m.campaign);
					}
				}

				if (seriesIds.length > 0) {
					const seriesMasterEvents = await db
						.select({
							event: eventTable,
							campaign: campaignTable
						})
						.from(eventTable)
						.leftJoin(campaignTable, eq(eventTable.campaignId, campaignTable.id))
						.where(and(inArray(eventTable.seriesId, seriesIds), isNull(eventTable.recurringEventId)));

					for (const sm of seriesMasterEvents) {
						if (sm.campaign && sm.event.seriesId) {
							seriesCampaignMap.set(sm.event.seriesId, sm.campaign);
						}
					}
				}
			}

			for (const r of allEventsWithCampaign) {
				processedEventIds.add(r.event.id);
				let eventCampaign = r.campaign;

				// Heal instance bit rot if missing campaignId
				if (!eventCampaign) {
					if (r.event.recurringEventId && masterCampaignMap.has(r.event.recurringEventId)) {
						eventCampaign = masterCampaignMap.get(r.event.recurringEventId)!;
						await db.update(eventTable).set({ campaignId: eventCampaign.id }).where(eq(eventTable.id, r.event.id));
					} else if (r.event.seriesId && seriesCampaignMap.has(r.event.seriesId)) {
						eventCampaign = seriesCampaignMap.get(r.event.seriesId)!;
						await db.update(eventTable).set({ campaignId: eventCampaign.id }).where(eq(eventTable.id, r.event.id));
					}
				}

				const syncIds = getCampaignTargetIds(eventCampaign?.content);
				let shouldBeSynced = syncIds.includes(config.id);

				if (shouldBeSynced) {
					if (provider.shouldSyncEvent) {
						if (!provider.shouldSyncEvent(r.event)) shouldBeSynced = false;
					} else {
						if (r.event.status === 'tentative' || !r.event.isPublic) shouldBeSynced = false;
					}
				}

				const existingMapping = eventMappingMap.get(r.event.id);
				const itemSyncState = getItemSyncState(eventCampaign?.content, r.event.id, config.id);
				const existingExternalId = itemSyncState?.externalId || existingMapping?.externalId;

				if (shouldBeSynced) {
					itemsToSync.push({ id: r.event.id, entityType: 'event', action: 'sync' });
				} else if (existingExternalId) {
					itemsToSync.push({
						id: r.event.id,
						entityType: 'event',
						action: 'unpublish',
						mappingId: existingMapping?.id,
						externalId: existingExternalId
					});
				}
			}
		}

		// Handle orphan event mappings (where event was deleted from DB)
		for (const [eventId, mapping] of eventMappingMap.entries()) {
			if (!processedEventIds.has(eventId)) {
				itemsToSync.push({
					id: eventId,
					entityType: 'event',
					action: 'unpublish',
					mappingId: mapping.id,
					externalId: mapping.externalId
				});
			}
		}

		// 2. Process Announcements (if provider supports announcements)
		const processedAnnouncementIds = new Set<string>();
		if (provider.supportedEntityTypes.includes('announcement')) {
			const allAnnouncementsWithCampaign = await db
				.select({
					announcement: announcementTable,
					campaign: campaignTable
				})
				.from(announcementTable)
				.leftJoin(campaignTable, eq(announcementTable.campaignId, campaignTable.id));

			for (const r of allAnnouncementsWithCampaign) {
				processedAnnouncementIds.add(r.announcement.id);
				const syncIds = getCampaignTargetIds(r.campaign?.content);
				const shouldBeSynced = syncIds.includes(config.id) &&
					r.announcement.status === 'active' &&
					r.announcement.isPublic === true;

				const existingMapping = announcementMappingMap.get(r.announcement.id);
				const itemSyncState = getItemSyncState(r.campaign?.content, r.announcement.id, config.id);
				const existingExternalId = itemSyncState?.externalId || existingMapping?.externalId;

				if (shouldBeSynced) {
					itemsToSync.push({ id: r.announcement.id, entityType: 'announcement', action: 'sync' });
				} else if (existingExternalId) {
					itemsToSync.push({
						id: r.announcement.id,
						entityType: 'announcement',
						action: 'unpublish',
						mappingId: existingMapping?.id,
						externalId: existingExternalId
					});
				}
			}
		}

		// Handle orphan announcement mappings or stale announcement mappings on non-announcement providers
		for (const [announcementId, mapping] of announcementMappingMap.entries()) {
			if (!processedAnnouncementIds.has(announcementId)) {
				itemsToSync.push({
					id: announcementId,
					entityType: 'announcement',
					action: 'unpublish',
					mappingId: mapping.id,
					externalId: mapping.externalId
				});
			}
		}

		// If queue is empty, finish immediately
		if (itemsToSync.length === 0) {
			const [op] = await db.insert(syncOperationTable).values({
				syncConfigId: configId,
				operation: 'push',
				status: 'completed',
				entityType: 'event',
				startedAt: new Date(),
				completedAt: new Date(),
				results: { total: 0, processed: 0, pushed: 0, pulled, errors }
			}).returning({ id: syncOperationTable.id });

			await db.update(syncConfigTable).set({
				lastSyncAt: new Date(),
				nextSyncAt: this.calculateNextSync(config)
			}).where(eq(syncConfigTable.id, configId));

			return { operationId: op.id, total: 0, pulled, done: true };
		}

		// Create operation record with queue for chunked batch execution
		const [operationRow] = await db.insert(syncOperationTable).values({
			syncConfigId: configId,
			operation: 'push',
			status: 'pending',
			entityType: 'event',
			startedAt: new Date(),
			results: {
				total: itemsToSync.length,
				processed: 0,
				pushed: 0,
				pulled,
				errors,
				itemsToSync
			}
		}).returning({ id: syncOperationTable.id });

		return {
			operationId: operationRow.id,
			total: itemsToSync.length,
			pulled,
			done: false
		};
	}

	/**
	 * Process a batch of items for an ongoing bulk sync operation.
	 * Runs within safe serverless execution limits (e.g. 10 items per batch).
	 */
	async processBulkSyncBatch(
		configId: string,
		operationId: string,
		batchSize = 10
	): Promise<{ done: boolean; processed: number; total: number; pushed: number; errors: any[] }> {
		const [opRow] = await db
			.select()
			.from(syncOperationTable)
			.where(eq(syncOperationTable.id, operationId));

		if (!opRow) {
			throw new Error(`Sync operation not found: ${operationId}`);
		}

		const results = (opRow.results as any) || {};
		const itemsToSync = (results.itemsToSync as any[]) || [];
		const total = Number(results.total || itemsToSync.length);
		let processed = Number(results.processed || 0);
		let pushed = Number(results.pushed || 0);
		const pulled = Number(results.pulled || 0);
		const errors = (results.errors as any[]) || [];

		if (opRow.status === 'completed' || processed >= total) {
			return { done: true, processed: total, total, pushed, errors };
		}

		const [configRow] = await db
			.select()
			.from(syncConfigTable)
			.where(eq(syncConfigTable.id, configId));

		if (!configRow) {
			throw new Error(`Sync config not found: ${configId}`);
		}

		const config = this.rowToConfig(configRow);
		const provider = await this.getProviderInstance(config);

		const batch = itemsToSync.slice(processed, processed + batchSize);

		for (const item of batch) {
			try {
				if (item.action === 'unpublish') {
					if (item.externalId) {
						try {
							await provider.deleteEvent(item.externalId);
						} catch (delErr: any) {
							console.warn(`[BulkSync] Provider delete warning for ${item.externalId}:`, delErr);
						}
					}
					if (item.mappingId) {
						await db.delete(syncMappingTable).where(eq(syncMappingTable.id, item.mappingId));
					}
					// Also clean up from campaign
					const table = item.entityType === 'event' ? eventTable : announcementTable;
					const [itemRow] = await db.select({ campaignId: table.campaignId }).from(table).where(eq(table.id, item.id));
					if (itemRow?.campaignId) {
						const [camp] = await db.select().from(campaignTable).where(eq(campaignTable.id, itemRow.campaignId));
						if (camp && (camp.content as any)?.version === 1) {
							const cContent = camp.content as CampaignContent;
							if (cContent.items?.[item.id]?.syncs?.[config.id]) {
								delete cContent.items[item.id].syncs[config.id];
							}
							if (item.externalId && cContent.externalIds?.[item.externalId]) {
								delete cContent.externalIds[item.externalId];
							}
							await db.update(campaignTable).set({ content: cContent, updatedAt: new Date() }).where(eq(campaignTable.id, camp.id));
						}
					}
				} else if (item.action === 'sync') {
					await this.executeSyncItem(config, provider, item.id, item.entityType);
					pushed++;
				}
			} catch (err: any) {
				console.error(`[BulkSync] Failed to process ${item.entityType} ${item.id}:`, err);
				errors.push({ id: item.id, message: err.message || String(err) });
			}
		}

		processed += batch.length;
		const done = processed >= total;

		if (done) {
			await db.update(syncOperationTable).set({
				status: errors.length > 0 && pushed === 0 ? 'failed' : 'completed',
				completedAt: new Date(),
				error: errors.length > 0 ? JSON.stringify(errors) : null,
				results: {
					total,
					processed,
					pushed,
					pulled,
					errors,
					itemsToSync: [] // clear queue to minimize storage
				}
			}).where(eq(syncOperationTable.id, operationId));

			await db.update(syncConfigTable).set({
				lastSyncAt: new Date(),
				nextSyncAt: this.calculateNextSync(config)
			}).where(eq(syncConfigTable.id, configId));
		} else {
			await db.update(syncOperationTable).set({
				results: {
					total,
					processed,
					pushed,
					pulled,
					errors,
					itemsToSync
				}
			}).where(eq(syncOperationTable.id, operationId));
		}

		return { done, processed, total, pushed, errors };
	}

	/**
	 * Pull events from external provider and update local database
	 */
	private async pullFromProvider(
		config: SyncConfig,
		provider: SyncProvider
	): Promise<{ pulled: number; errors: SyncResult['errors'] }> {
		const result = { pulled: 0, errors: [] as SyncResult['errors'] };

		try {
			// Pull events using sync token if available
			const { events, nextSyncToken } = await provider.pullEvents(config.syncToken);

			for (const externalEvent of events) {
				try {
					await this.processExternalEvent(config, externalEvent);
					result.pulled++;
				} catch (error: any) {
					console.error(`[SyncService] Failed to process event ${externalEvent.externalId}:`, error);
					result.errors.push({
						externalId: externalEvent.externalId,
						message: `Failed to process event ${externalEvent.externalId}: ${error.message}`
					});
				}
			}

			// Store new sync token for incremental syncs
			if (nextSyncToken) {
				await db
					.update(syncConfigTable)
					.set({ syncToken: nextSyncToken })
					.where(eq(syncConfigTable.id, config.id));
			}
		} catch (error: any) {
			console.error(`[SyncService] Pull operation failed:`, error);
			console.error(`[SyncService] Error details:`, {
				message: error.message,
				code: error.code,
				status: error.status,
				stack: error.stack
			});
			result.errors.push({
				message: `Pull failed: ${error.message}${error.code ? ` (code: ${error.code})` : ''}${error.status ? ` (status: ${error.status})` : ''}`
			});
		}

		return result;
	}

	/**
	 * Record an item's sync state in its campaign content (creating campaign if missing).
	 */
	private async recordItemSyncInCampaign(
		event: typeof eventTable.$inferSelect,
		config: SyncConfig,
		externalId: string,
		etag?: string
	): Promise<void> {
		let campaignRow: typeof campaignTable.$inferSelect | undefined;
		if (event.campaignId) {
			const [camp] = await db.select().from(campaignTable).where(eq(campaignTable.id, event.campaignId));
			campaignRow = camp;
		}

		if (!campaignRow) {
			const initialContent: CampaignContent = {
				version: 1,
				targets: { [config.id]: { enabled: true } },
				items: {
					[event.id]: {
						entityType: 'event',
						syncs: {
							[config.id]: {
								status: 'idle',
								externalId,
								etag,
								lastSyncedAt: new Date().toISOString()
							}
						}
					}
				},
				externalIds: {
					[externalId]: {
						itemId: event.id,
						configId: config.id
					}
				}
			};

			const [newCamp] = await db.insert(campaignTable).values({
				name: event.summary || 'Campaign',
				userId: event.userId || config.userId,
				content: initialContent
			}).returning();

			await db.update(eventTable).set({ campaignId: newCamp.id }).where(eq(eventTable.id, event.id));
		} else {
			let content: CampaignContent = (campaignRow.content as any)?.version === 1
				? (campaignRow.content as CampaignContent)
				: createDefaultCampaignContent(getCampaignTargetIds(campaignRow.content));

			content.targets[config.id] = { enabled: true };
			if (!content.items) content.items = {};
			if (!content.items[event.id]) {
				content.items[event.id] = { entityType: 'event', syncs: {} };
			}
			content.items[event.id].syncs[config.id] = {
				status: 'idle',
				externalId,
				etag,
				lastSyncedAt: new Date().toISOString()
			};
			if (!content.externalIds) content.externalIds = {};
			content.externalIds[externalId] = {
				itemId: event.id,
				configId: config.id
			};

			await db.update(campaignTable).set({ content, updatedAt: new Date() }).where(eq(campaignTable.id, campaignRow.id));
		}
	}

	/**
	 * Process an external event from a provider (create or update local event)
	 */
	private async processExternalEvent(config: SyncConfig, externalEvent: ExternalEvent): Promise<void> {
		// First, check for mapping via campaign.content.externalIds, then legacy syncMappingTable
		const [campWithExtId] = await db
			.select()
			.from(campaignTable)
			.where(sql`(${campaignTable.content}->'externalIds' ? ${externalEvent.externalId})`);

		const [legacyMapping] = await db
			.select()
			.from(syncMappingTable)
			.where(
				and(
					eq(syncMappingTable.syncConfigId, config.id),
					eq(syncMappingTable.externalId, externalEvent.externalId)
				)
			);

		const mappedEventId = campWithExtId
			? (campWithExtId.content as any)?.externalIds?.[externalEvent.externalId]?.itemId
			: legacyMapping?.eventId;

		if (externalEvent.status === 'cancelled') {
			if (mappedEventId) {
				await db
					.update(eventTable)
					.set({ status: 'cancelled', updatedAt: new Date() })
					.where(eq(eventTable.id, mappedEventId));
				if (legacyMapping) {
					await db.delete(syncMappingTable).where(eq(syncMappingTable.id, legacyMapping.id));
				}
				if (campWithExtId && (campWithExtId.content as any)?.version === 1) {
					const cContent = campWithExtId.content as CampaignContent;
					if (cContent.items?.[mappedEventId]?.syncs?.[config.id]) {
						cContent.items[mappedEventId].syncs[config.id].status = 'idle';
						cContent.items[mappedEventId].syncs[config.id].lastSyncedAt = new Date().toISOString();
						if (cContent.externalIds) {
							cContent.externalIds[externalEvent.externalId] = {
								itemId: mappedEventId,
								configId: config.id
							};
						}
						await db.update(campaignTable).set({ content: cContent, updatedAt: new Date() }).where(eq(campaignTable.id, campWithExtId.id));
					}
				}
				await publishEventChange('update', [mappedEventId]);
			}
			return;
		}

		if (mappedEventId) {
			// Update existing event
			const [currentEvent] = await db
				.select()
				.from(eventTable)
				.where(eq(eventTable.id, mappedEventId));

			if (currentEvent) {
				// Skip update if we just modified it locally (within last 30 seconds)
				const timeSinceUpdate = Date.now() - currentEvent.updatedAt.getTime();
				if (timeSinceUpdate < 30000) {
					if (legacyMapping) {
						await db.delete(syncMappingTable).where(eq(syncMappingTable.id, legacyMapping.id));
					}
					return;
				}
			}

			const updateParts = await this.mapExternalToInternalWithContacts(externalEvent, config.userId);

			await db
				.update(eventTable)
				.set(updateParts)
				.where(eq(eventTable.id, mappedEventId));

			if (legacyMapping) {
				await db.delete(syncMappingTable).where(eq(syncMappingTable.id, legacyMapping.id));
			}

			if (campWithExtId && (campWithExtId.content as any)?.version === 1) {
				const cContent = campWithExtId.content as CampaignContent;
				if (cContent.items?.[mappedEventId]?.syncs?.[config.id]) {
					cContent.items[mappedEventId].syncs[config.id].etag = externalEvent.etag ?? undefined;
					cContent.items[mappedEventId].syncs[config.id].lastSyncedAt = new Date().toISOString();
					if (cContent.externalIds) {
						cContent.externalIds[externalEvent.externalId] = {
							itemId: mappedEventId,
							configId: config.id
						};
					}
					await db.update(campaignTable).set({ content: cContent, updatedAt: new Date() }).where(eq(campaignTable.id, campWithExtId.id));
				}
			}

			await publishEventChange('update', [mappedEventId]);

			// Update event contacts status
			if (externalEvent.attendees) {
				for (const attendee of externalEvent.attendees) {
					const [contactRecord] = await db.query.contact.findMany({
						where: (c, { eq, exists }) => exists(
							db.select().from(contactEmailTable)
								.where(and(
									eq(contactEmailTable.contactId, c.id),
									eq(contactEmailTable.value, attendee.email)
								))
						),
						limit: 1
					});

					if (contactRecord) {
						await db.insert(eventContactTable).values({
							eventId: mappedEventId,
							contactId: contactRecord.id,
							participationStatus: attendee.responseStatus || 'needsAction'
						}).onConflictDoUpdate({
							target: [eventContactTable.eventId, eventContactTable.contactId],
							set: { participationStatus: attendee.responseStatus || 'needsAction' }
						});
					}
				}
			}

		} else {
			// Check if this is an "echo" of an event we created/pushed
			const appEventId = externalEvent.metadata?.app_event_id;
			let identifiedInternalId: string | undefined = appEventId;

			// Support deterministic Google IDs (mp + dashless uuid)
			if (!identifiedInternalId && externalEvent.externalId.startsWith('mp')) {
				const dashless = externalEvent.externalId.substring(2);
				if (dashless.length === 32) {
					// Reconstruct UUID format
					identifiedInternalId = `${dashless.substring(0, 8)}-${dashless.substring(8, 12)}-${dashless.substring(12, 16)}-${dashless.substring(16, 20)}-${dashless.substring(20)}`;
					console.log(`[SyncService] Identified internal ID ${identifiedInternalId} from deterministic external ID ${externalEvent.externalId}`);
				}
			}

			if (identifiedInternalId) {
				const [existingEvent] = await db
					.select()
					.from(eventTable)
					.where(eq(eventTable.id, identifiedInternalId));

				if (existingEvent) {
					console.log(`[SyncService] Identified echo for event ${identifiedInternalId}. Healing/Updating campaign sync state.`);

					await this.recordItemSyncInCampaign(existingEvent, config, externalEvent.externalId, externalEvent.etag ?? undefined);
					return;
				} else {
					console.log(`[SyncService] Detected echo for deleted event ${identifiedInternalId}. Ignoring to prevent resurrection.`);
					return;
				}
			}

			// Before creating a new event, check if we already have a local event with similar properties
			const timeWindow = 2 * 60 * 1000; // 2 minutes
			let startTimeCheck = undefined;

			if (externalEvent.startDateTime) {
				const t = externalEvent.startDateTime.getTime();
				startTimeCheck = and(
					gte(eventTable.startDateTime, new Date(t - timeWindow)),
					lte(eventTable.startDateTime, new Date(t + timeWindow))
				);
			}

			const recentEvents = await db
				.select()
				.from(eventTable)
				.where(
					or(
						eq(eventTable.summary, externalEvent.summary),
						startTimeCheck
					)
				);

			for (const recentEvent of recentEvents) {
				let startTimesMatch = false;

				if (recentEvent.startDateTime && externalEvent.startDateTime) {
					const t1 = recentEvent.startDateTime.getTime();
					const t2 = externalEvent.startDateTime.getTime();
					startTimesMatch = Math.abs(t1 - t2) < 1000;
				}

				if (startTimesMatch) {
					console.log(`[SyncService] Fuzzy match found! healing campaign sync state for event ${recentEvent.id}`);
					await this.recordItemSyncInCampaign(recentEvent, config, externalEvent.externalId, externalEvent.etag ?? undefined);
					return; // Don't create duplicate
				}
			}

			// Create new event - no matching local event found
			const mappedFields = await this.mapExternalToInternalWithContacts(externalEvent, config.userId);
			const [newEvent] = await db.insert(eventTable).values({
				...mappedFields,
				createdAt: new Date(),
				summary: mappedFields.summary || externalEvent.summary || 'Untitled Event',
				userId: mappedFields.userId || config.userId,
				startDateTime: mappedFields.startDateTime || externalEvent.startDateTime || new Date()
			} as any).returning({ id: eventTable.id });

			const initialContent: CampaignContent = {
				version: 1,
				targets: { [config.id]: { enabled: true } },
				items: {
					[newEvent.id]: {
						entityType: 'event',
						syncs: {
							[config.id]: {
								status: 'idle',
								externalId: externalEvent.externalId,
								etag: externalEvent.etag ?? undefined,
								lastSyncedAt: new Date().toISOString()
							}
						}
					}
				},
				externalIds: {
					[externalEvent.externalId]: {
						itemId: newEvent.id,
						configId: config.id
					}
				}
			};

			const [newCamp] = await db.insert(campaignTable).values({
				name: mappedFields.summary || externalEvent.summary || 'Untitled Event',
				userId: mappedFields.userId || config.userId,
				content: initialContent
			}).returning();

			await db.update(eventTable).set({ campaignId: newCamp.id }).where(eq(eventTable.id, newEvent.id));

			// Generate assets for the new event
			await import('$lib/server/events/assets').then(m => m.generateEventAssets(newEvent.id));

			await publishEventChange('create', [newEvent.id]);

			// Update event contacts associations and their status
			if (externalEvent.attendees) {
				for (const attendee of externalEvent.attendees) {
					const [contactRecord] = await db.query.contact.findMany({
						where: (c, { eq, exists }) => exists(
							db.select().from(contactEmailTable)
								.where(and(
									eq(contactEmailTable.contactId, c.id),
									eq(contactEmailTable.value, attendee.email)
								))
						),
						limit: 1
					});

					if (contactRecord) {
						await db.insert(eventContactTable).values({
							eventId: newEvent.id,
							contactId: contactRecord.id,
							participationStatus: attendee.responseStatus || 'needsAction'
						}).onConflictDoUpdate({
							target: [eventContactTable.eventId, eventContactTable.contactId],
							set: { participationStatus: attendee.responseStatus || 'needsAction' }
						});
					}
				}
			}
		}
	}

	public async handleWebhook(
		providerId: ProviderType,
		payload: any
	): Promise<{ configId: string; processed: boolean }> {
		const configIdsToSync = new Set<string>();

		if (providerId === 'google-calendar' && payload?.channelToken) {
			configIdsToSync.add(payload.channelToken);
		} else if (providerId === 'microsoft-calendar' && payload?.value && Array.isArray(payload.value)) {
			// Extract clientState from each notification
			for (const notification of payload.value) {
				if (notification.clientState) {
					configIdsToSync.add(notification.clientState);
				}
			}
		}

		if (configIdsToSync.size > 0) {
			const configs = await db
				.select()
				.from(syncConfigTable)
				.where(and(
					eq(syncConfigTable.providerType, providerId),
					eq(syncConfigTable.enabled, true),
					inArray(syncConfigTable.id, Array.from(configIdsToSync))
				));

			for (const configRow of configs) {
				this.syncEvents(configRow.id).catch((error) => {
					console.error(`Webhook-triggered sync failed for config ${configRow.id}:`, error);
				});
			}

			return {
				configId: configs[0]?.id || '',
				processed: true
			};
		}

		// Fallback: If payload lacks specific config info, sync all configs for the provider
		const configs = await db
			.select()
			.from(syncConfigTable)
			.where(and(eq(syncConfigTable.providerType, providerId), eq(syncConfigTable.enabled, true)));

		for (const configRow of configs) {
			// Trigger async sync (don't await - run in background)
			this.syncEvents(configRow.id).catch((error) => {
				console.error(`Webhook-triggered sync failed for config ${configRow.id}:`, error);
			});
		}

		return {
			configId: configs[0]?.id || '',
			processed: true
		};
	}

	/**
	 * Setup webhook for a sync config
	 */
	async setupWebhook(configId: string): Promise<void> {
		const [configRow] = await db.select().from(syncConfigTable).where(eq(syncConfigTable.id, configId));

		if (!configRow) {
			throw new Error(`Sync config not found: ${configId}`);
		}

		const config = this.rowToConfig(configRow);
		const provider = await this.getProviderInstance(config);

		if (!provider.supportsWebhooks) {
			return;
		}

		// Cancel existing webhooks
		// Cancel existing webhooks
		await this.removeWebhook(configId);

		// Construct callback URL
		// Microsoft Graph requires a publicly accessible HTTPS URL.
		const baseUrl = (env.SYNC_WEBHOOK_URL || env.BETTER_AUTH_URL || 'https://localhost:5173').replace(/\/$/, '');
		let callbackUrl = `${baseUrl}/api/sync/webhook/${config.providerType}`;
		
		// Ensure it uses https if it's the default localhost fallback
		if (callbackUrl.startsWith('http://localhost') && provider.type === 'microsoft-calendar') {
			// Note: This will still fail actual delivery because localhost isn't public, 
			// but we keep it here as a fallback or if they are testing behind a proxy that accepts https.
			// The proper fix is using SYNC_WEBHOOK_URL with ngrok.
		}

		// Setup new webhook
		if (provider.setupWebhook) {
			const subscription = await provider.setupWebhook(callbackUrl);

			if (subscription) {
				await db.insert(webhookSubscriptionTable).values(subscription as any);
				await db
					.update(syncConfigTable)
					.set({ webhookId: subscription.id })
					.where(eq(syncConfigTable.id, configId));
			}
		}
	}


	/**
	 * Remove webhook for a sync config
	 */
	async removeWebhook(configId: string): Promise<void> {
		const [configRow] = await db.select().from(syncConfigTable).where(eq(syncConfigTable.id, configId));
		if (!configRow) return;

		const config = this.rowToConfig(configRow);

		// We try to get the provider, but if it fails (e.g. auth error), we still want to delete the subscription from DB
		let provider: SyncProvider | undefined;
		try {
			provider = await this.getProviderInstance(config);
		} catch (e) {
			console.warn(`[SyncService] Could not get provider instance while removing webhook:`, e);
		}

		const existingSubscriptions = await db
			.select()
			.from(webhookSubscriptionTable)
			.where(eq(webhookSubscriptionTable.syncConfigId, configId));

		for (const sub of existingSubscriptions) {
			try {
				if (provider && provider.cancelWebhook) {
					await provider.cancelWebhook(sub as any);
				}
			} catch (error) {
				console.error('Failed to cancel existing webhook:', error);
			}
			await db.delete(webhookSubscriptionTable).where(eq(webhookSubscriptionTable.id, sub.id));
		}

		await db
			.update(syncConfigTable)
			.set({ webhookId: null })
			.where(eq(syncConfigTable.id, configId));
	}

	/**
	 * Check webhook status for a sync config
	 */
	async checkWebhookStatus(configId: string): Promise<{ active: boolean; expiresAt?: Date }> {
		const [subscription] = await db
			.select()
			.from(webhookSubscriptionTable)
			.where(eq(webhookSubscriptionTable.syncConfigId, configId))
			.orderBy(desc(webhookSubscriptionTable.createdAt))
			.limit(1);

		if (!subscription) {
			return { active: false };
		}

		const now = new Date();
		if (subscription.expiresAt && subscription.expiresAt < now) {
			return { active: false, expiresAt: subscription.expiresAt };
		}

		return { active: true, expiresAt: subscription.expiresAt ?? undefined };
	}

	/**
	 * Renew expiring webhooks
	 * Should be called periodically (e.g., daily cron job)
	 */
	async renewWebhooks(): Promise<void> {
		const expiringDate = new Date();
		expiringDate.setHours(expiringDate.getHours() + 24);

		const expiring = await db
			.select()
			.from(webhookSubscriptionTable)
			.where(lt(webhookSubscriptionTable.expiresAt, expiringDate));

		for (const subscription of expiring) {
			try {

				const [configRow] = await db
					.select()
					.from(syncConfigTable)
					.where(eq(syncConfigTable.id, subscription.syncConfigId));

				if (!configRow || !configRow.enabled) {
					await db
						.delete(webhookSubscriptionTable)
						.where(eq(webhookSubscriptionTable.id, subscription.id));
					continue;
				}

				const config = this.rowToConfig(configRow);
				const provider = await this.getProviderInstance(config);

				if (!provider.supportsWebhooks || !provider.renewWebhook) {
					continue;
				}

				const newSubscription = await provider.renewWebhook(subscription as any);

				if (newSubscription) {
					// Delete old subscription
					await db
						.delete(webhookSubscriptionTable)
						.where(eq(webhookSubscriptionTable.id, subscription.id));

					// Insert new subscription
					await db.insert(webhookSubscriptionTable).values(newSubscription as any);

					// Update sync config with new webhook ID
					await db
						.update(syncConfigTable)
						.set({ webhookId: newSubscription.id })
						.where(eq(syncConfigTable.id, config.id));
				}
			} catch (error: any) {
				console.error(`[SyncService] Failed to renew webhook for subscription ${subscription.id}:`, error);
			}
		}
	}

	/**
	 * Map external event to internal event format with owner resolution
	 */
	private async mapExternalToInternalWithContacts(
		external: ExternalEvent,
		defaultUserId: string
	): Promise<Partial<typeof eventTable.$inferInsert>> {
		let resolvedUserId = defaultUserId;

		// Attempt to resolve owner via contact email
		const resolvedContact = await resolveEventContact(external);
		if (resolvedContact?.email) {
			const [userRow] = await db
				.select()
				.from(userTable)
				.where(eq(userTable.email, resolvedContact.email))
				.limit(1);

			if (userRow) {
				resolvedUserId = userRow.id;
			}
		}

		const result: Partial<typeof eventTable.$inferInsert> = {
			userId: resolvedUserId,
			summary: external.summary,
			updatedAt: new Date()
		};

		if (external.description !== undefined) result.description = external.description;
		// if (external.location !== undefined) result.location = external.location;
		if (external.startDateTime !== undefined) result.startDateTime = external.startDateTime;
		if (external.startTimeZone !== undefined) result.startTimeZone = external.startTimeZone;
		if (external.endDateTime !== undefined) result.endDateTime = external.endDateTime;
		if (external.endTimeZone !== undefined) result.endTimeZone = external.endTimeZone;
		if (external.attendees !== undefined) result.attendees = external.attendees as any;
		if (external.recurrence !== undefined) result.recurrence = external.recurrence;
		if (external.reminders !== undefined) result.reminders = external.reminders as any;

		return result;
	}

	/**
	 * Map internal event to external event format
	 */
	private async mapInternalToExternal(
		internal: any,
		providerId: ProviderType
	): Promise<ExternalEvent> {

		const isEvent = 'summary' in internal;
		const entityType = isEvent ? 'event' : 'announcement';

		const summary = internal.summary || internal.title || '';
		const descriptionRaw = internal.description || internal.content || '';

		// NOTE: Recurrence rules are intentionally NOT synced to external providers
		// because the system expands recurrence locally and syncs individual 
		// instances as standalone events. Syncing the rule would create duplicate series.
		let recurrenceRules: string[] | undefined = undefined;
		/*
		if (internal.seriesId) {
			const [series] = await db
				.select()
				.from(recurringSeries)
				.where(eq(recurringSeries.id, internal.seriesId));
			if (series?.rrule) {
				recurrenceRules = [series.rrule];
			}
		}
		// Fallback to legacy recurrence field if no series
		if (!recurrenceRules && internal.recurrence) {
			recurrenceRules = internal.recurrence as string[];
		}
		*/


		// Fetch associated contacts
		const associatedContacts = (await getEntityContacts(entityType, internal.id)) || [];

		// Only sync contacts with "Employee" tag to external calendar providers (Google, Microsoft).
		// External contacts are commented out for data privacy reasons until privacy flows are finalized.
		const attendees: NonNullable<ExternalEvent['attendees']> = [];
		for (const contact of associatedContacts) {
			const isEmployee = isEmployeeContact(contact);

			if (isEmployee) {
				// Get primary email
				const email = (contact as any).emails?.find((e: any) => e.primary)?.value ||
					(contact as any).emails?.[0]?.value;

				if (email) {
					// Find the association to get participation status
					let participationStatus: string | null = null;

					if (isEvent) {
						const [assoc] = await db
							.select()
							.from(eventContactTable)
							.where(and(
								eq(eventContactTable.eventId, internal.id),
								eq(eventContactTable.contactId, contact.id)
							))
							.limit(1);
						participationStatus = assoc?.participationStatus || null;
					}

					attendees.push({
						email,
						displayName: contact.displayName || `${contact.givenName || ''} ${contact.familyName || ''}`.trim(),
						responseStatus: participationStatus || 'needsAction'
					});
				}
			}
			/*
			// External contacts excluded until data privacy flows are finalized:
			else {
				// Do not sync external contacts as attendees
			}
			*/
		}

		// Resolve Attached Resources
		if (isEvent) {
			const linkedResources = await db
				.select({ resource: resourceTable })
				.from(eventResourceTable)
				.innerJoin(resourceTable, eq(eventResourceTable.resourceId, resourceTable.id))
				.where(eq(eventResourceTable.eventId, internal.id));

			for (const { resource: res } of linkedResources) {
				let calendars: any[] = [];
				if (typeof res.allocationCalendars === 'string') {
					try { calendars = JSON.parse(res.allocationCalendars); } catch { calendars = []; }
				} else if (Array.isArray(res.allocationCalendars)) {
					calendars = res.allocationCalendars;
				}

				for (const cal of calendars) {
					const email = cal.calendarId || cal.email;
					if (email && typeof email === 'string' && email.includes('@')) {
						attendees.push({
							email: email,
							displayName: res.name || cal.name || 'Resource',
							responseStatus: 'accepted',
							type: 'resource',
							resourceId: res.id
						});
					}
				}
			}
		}



		// Resolve Venues (Locations)
		let venues: ExternalEvent['venues'] | undefined;
		let venue: ExternalEvent['venue'] | undefined;
		let venueId: string | undefined;

		// Try to find structured location data first
		const locationTableToUse = isEvent ? eventLocationTable : announcementLocation;
		const whereClause = isEvent ? eq(eventLocationTable.eventId, internal.id) : eq(announcementLocation.announcementId, internal.id);

		const locations = await db
			.select({ location: locationTable })
			.from(locationTableToUse as any)
			.innerJoin(locationTable, eq((locationTableToUse as any).locationId, locationTable.id))
			.where(whereClause as any);

		if (locations.length > 0) {
			venues = locations.map(l => ({
				id: l.location.id,
				name: l.location.name,
				address: l.location.street ? `${l.location.street} ${l.location.houseNumber || ''}`.trim() : undefined,
				city: l.location.city ?? undefined,
				country: l.location.country ?? undefined,
				zip: l.location.zip ?? undefined,
				province: l.location.state ?? undefined,
			}));

			// For backward compatibility, pick the first one as primary
			const primary = locations[0].location;
			venueId = primary.id;
			venue = {
				name: primary.name,
				address: primary.street ? `${primary.street} ${primary.houseNumber || ''}`.trim() : undefined,
				city: primary.city ?? undefined,
				country: primary.country ?? undefined,
				zip: primary.zip ?? undefined,
				province: primary.state ?? undefined,
			};
		} else if (internal.location) {
			// Fallback to text location if no structured location is linked
			venue = {
				name: internal.location
			};
			venues = [venue];
		}

		// Resolve Organizer (Contact with "Employee" tag)
		let organizer: ExternalEvent['organizer'] | undefined;
		let organizerId: string | undefined;

		// Find associated contacts who are employees
		for (const contact of associatedContacts) {
			const contactTags = (contact as any).tags || [];
			const isEmployee = contactTags.some((ct: any) => {
				const tagName = (ct.name || ct.tag?.name || '').toLowerCase();
				return tagName === 'employee' || tagName === 'employees';
			});

			if (isEmployee) {
				// Use the first employee found as organizer
				organizerId = contact.id;
				const email = (contact as any).emails?.find((e: any) => e.primary)?.value ||
					(contact as any).emails?.[0]?.value;
				const phone = (contact as any).phones?.find((p: any) => p.primary)?.value ||
					(contact as any).phones?.[0]?.value;

				organizer = {
					name: contact.displayName || `${contact.givenName || ''} ${contact.familyName || ''}`.trim(),
					email: email,
					phone: phone
				};
				break; // Only one organizer
			}
		}


		// Resolve Tags
		const tags: Array<{ id: string; name: string }> = [];
		const tagTableToUse = isEvent ? eventTag : announcementTag;
		const tagWhereClause = isEvent ? eq(eventTag.eventId, internal.id) : eq(announcementTag.announcementId, internal.id);

		const entityTags = await db
			.select({ tag: tagTable })
			.from(tagTableToUse as any)
			.innerJoin(tagTable, eq((tagTableToUse as any).tagId, tagTable.id))
			.where(tagWhereClause as any);

		if (entityTags.length > 0) {
			tags.push(...entityTags.map((t: { tag: { id: string, name: string } }) => ({ id: t.tag.id, name: t.tag.name })));
		}

		// Helper to resolve absolute URLs
		const resolveUrl = (url: string | null | undefined) => {
			if (!url) return undefined;
			if (url.startsWith('http')) return url;
			// Use env.BETTER_AUTH_URL if available (from imports)
			const authUrl = (typeof env !== 'undefined' && (env as any).BETTER_AUTH_URL) ||
				(typeof process !== 'undefined' && process.env?.BETTER_AUTH_URL) ||
				'http://localhost:5173';
			return `${authUrl}${url.startsWith('/') ? '' : '/'}${url}`;
		};

		// Map Image (Pick hero image OR first image from description)
		let image: ExternalEvent['image'] | undefined;

		// 1. Use hero image if it exists
		if (internal.heroImage) {
			image = {
				url: resolveUrl(internal.heroImage)!,
				title: summary
			};
		}

		let description = descriptionRaw || undefined;

		// 2. Fall back to the first image embedded in the description
		if (!image && description) {
			const imgMatch = description.match(/<img[^>]+src="([^">]+)"/);
			if (imgMatch && imgMatch[1]) {
				image = {
					url: resolveUrl(imgMatch[1])!,
					title: summary
				};
			}
		}

		// 3. Fall back to the hero image of the associated location
		const primaryLocation = locations?.[0]?.location;
		if (!image && primaryLocation?.heroImage) {
			image = {
				url: resolveUrl(primaryLocation.heroImage)!,
				title: summary
			};
		}



		// Ensure all content URLs are absolute
		if (description) {
			description = description.replace(
				/(src|href)="(\/[^"]+)"/g,
				(match: string, attr: string, path: string) => `${attr}="${resolveUrl(path)}"`
			);
		}

		return {
			externalId: '',
			providerId,
			summary,
			status: internal.status,
			description,
			location: venue?.name || internal.location || undefined,
			startDateTime: internal.startDateTime || internal.createdAt || new Date(),
			startTimeZone: internal.startTimeZone || 'UTC',
			endDateTime: internal.endDateTime || null,
			endTimeZone: internal.endTimeZone || 'UTC',
			attendees: attendees.length > 0 ? attendees : undefined,
			recurrence: recurrenceRules,
			reminders: (internal.reminders as any) ?? undefined,
			source: (internal.source as any) ?? undefined,
			ticketPrice: internal.ticketPrice ?? undefined,
			venue,
			venues,
			venueId,
			organizer,
			tags,
			image,
			metadata: {
				entityType,
				eventId: isEvent ? internal.id : undefined,
				announcementId: !isEvent ? internal.id : undefined,
				seriesId: (internal as any).seriesId ?? undefined,
				app_event_id: internal.id,
				organizerId: organizerId,
				locationId: venueId,
				categoryBerlinDotDe: internal.categoryBerlinDotDe ?? undefined
			}
		};

	}

	/**
	 * Calculate next sync time based on config settings
	 */
	private calculateNextSync(config: SyncConfig): Date {
		const now = new Date();
		const intervalMinutes = (config.settings?.syncIntervalMinutes as number) || 60;
		now.setMinutes(now.getMinutes() + intervalMinutes);
		return now;
	}

	async syncItems(userId: string, itemIds: string[], entityType: 'event' | 'announcement' = 'event'): Promise<void> {
		try {
			const syncStartTime = Date.now();
			const MAX_SYNC_DURATION_MS = 25000; // 25s execution budget to prevent serverless timeouts

			// Get all enabled sync configs that support push (Global sweep)
			const syncConfigs = await db
				.select()
				.from(syncConfigTable)
				.where(
					eq(syncConfigTable.enabled, true)
				);

			for (const configRow of syncConfigs) {
				if (Date.now() - syncStartTime > MAX_SYNC_DURATION_MS) {
					console.warn(`[SyncService] Execution budget reached (${MAX_SYNC_DURATION_MS / 1000}s). Stopping syncItems sweep to avoid serverless timeout.`);
					break;
				}

				const config = this.rowToConfig(configRow);

				// Only consider push/bidirectional for push sync
				if (config.direction !== 'push' && config.direction !== 'bidirectional') {
					continue;
				}

				// Instantiate provider once per config for pre-flight and execution
				let provider: SyncProvider;
				try {
					provider = await this.getProviderInstance(config);
				} catch (providerInitErr) {
					console.warn(`[SyncService] Could not initialize provider for config ${config.id} (${config.providerType}):`, providerInitErr);
					continue;
				}

				// Pre-flight check: see if ANY of the items need sync for THIS config
				const itemsToProcess: string[] = [];
				for (const itemId of itemIds) {
					const { needsSync } = await this.checkSyncRequirement(config, itemId, entityType, provider);
					if (needsSync) {
						itemsToProcess.push(itemId);
					}
				}

				console.log(`[SyncService] syncItems: Config ${config.id} (${config.providerType}) - ${itemsToProcess.length}/${itemIds.length} items to process`);

				if (itemsToProcess.length === 0) {
					// None of the items are selected for this config and no mappings exist to clean up
					continue;
				}

				// Create operation record for transparency
				const [operationRow] = await db.insert(syncOperationTable).values({
					syncConfigId: config.id,
					operation: 'push',
					status: 'pending',
					entityType: entityType,
					startedAt: new Date(),
					entityId: itemsToProcess.length === 1 ? itemsToProcess[0] : null,
				}).returning({ id: syncOperationTable.id });

				const operationId = operationRow.id;

				try {

					for (const itemId of itemsToProcess) {
						if (Date.now() - syncStartTime > MAX_SYNC_DURATION_MS) {
							console.warn(`[SyncService] Execution budget reached (${MAX_SYNC_DURATION_MS / 1000}s). Stopping syncItems for config ${config.id} to avoid serverless timeout.`);
							break;
						}
						await this.syncSingleItem(config, provider, itemId, entityType);
					}

					// Update operation status
					await db
						.update(syncOperationTable)
						.set({
							status: 'completed',
							completedAt: new Date()
						})
						.where(eq(syncOperationTable.id, operationId));

				} catch (error: any) {
					console.error(`[SyncService] Failed to sync with config ${config.id}:`, error);

					// Update operation status
					await db
						.update(syncOperationTable)
						.set({
							status: 'failed',
							completedAt: new Date(),
							error: `${error.message}\n\nStack:\n${error.stack}`
						})
						.where(eq(syncOperationTable.id, operationId));
					// Continue with other configs even if one fails
				}
			}


		} catch (error: any) {
			console.error(`[SyncService] Error in syncItems:`, error);
			// Don't throw - sync failures shouldn't break CRUD operations
		}
	}

	/**
	 * Helper to check if an item actually needs processing for a specific sync config.
	 * Returns true if the item is explicitly selected OR if a mapping exists (needs update/delete).
	 */
	private async checkSyncRequirement(
		config: SyncConfig,
		itemId: string,
		entityType: 'event' | 'announcement',
		providerInstance?: SyncProvider
	): Promise<{ needsSync: boolean }> {
		const provider = providerInstance || await this.getProviderInstance(config);
		if (!provider.supportedEntityTypes.includes(entityType)) {
			return { needsSync: false };
		}

		// Check for existing mapping
		const mappingWhere = entityType === 'event'
			? and(eq(syncMappingTable.eventId, itemId), eq(syncMappingTable.syncConfigId, config.id))
			: and(eq(syncMappingTable.announcementId, itemId), eq(syncMappingTable.syncConfigId, config.id));

		const [mapping] = await db
			.select()
			.from(syncMappingTable)
			.where(mappingWhere);

		// Check granular sync settings (campaign-based)
		const table = entityType === 'event' ? eventTable : announcementTable;
		const [itemWithCampaign] = await db
			.select({
				item: table,
				campaign: campaignTable
			})
			.from(table)
			.leftJoin(campaignTable, eq(table.campaignId, campaignTable.id))
			.where(eq(table.id, itemId))
			.limit(1);

		if (!itemWithCampaign) {
			return { needsSync: !!mapping };
		}

		let campaign = itemWithCampaign.campaign;
		// Inherit campaign from master event for instances if missing
		if (!campaign && entityType === 'event') {
			const masterId = (itemWithCampaign.item as any)?.recurringEventId;
			if (masterId) {
				const [master] = await db
					.select({ campaign: campaignTable })
					.from(eventTable)
					.leftJoin(campaignTable, eq(eventTable.campaignId, campaignTable.id))
					.where(eq(eventTable.id, masterId))
					.limit(1);
				if (master?.campaign) {
					campaign = master.campaign;
					await db.update(eventTable).set({ campaignId: master.campaign.id }).where(eq(eventTable.id, itemId));
				}
			} else if ((itemWithCampaign.item as any)?.seriesId) {
				const [master] = await db
					.select({ campaign: campaignTable })
					.from(eventTable)
					.leftJoin(campaignTable, eq(eventTable.campaignId, campaignTable.id))
					.where(and(eq(eventTable.seriesId, (itemWithCampaign.item as any).seriesId), isNull(eventTable.recurringEventId)))
					.limit(1);
				if (master?.campaign) {
					campaign = master.campaign;
					await db.update(eventTable).set({ campaignId: master.campaign.id }).where(eq(eventTable.id, itemId));
				}
			}
		}

		const syncIds = getCampaignTargetIds(campaign?.content);
		let shouldBeSynced = syncIds.includes(config.id);

		if (entityType === 'event' && shouldBeSynced) {
			try {
				const event = itemWithCampaign.item as any;
				if (provider.shouldSyncEvent) {
					if (!provider.shouldSyncEvent(event)) shouldBeSynced = false;
				} else {
					if (event.status === 'tentative' || !event.isPublic) shouldBeSynced = false;
				}
			} catch (e) {
				// Fallback if provider cannot be instantiated
				const event = itemWithCampaign.item as any;
				if (event.status === 'tentative' || !event.isPublic) shouldBeSynced = false;
			}
		} else if (entityType === 'announcement' && shouldBeSynced) {
			const announcement = itemWithCampaign.item as any;
			if (announcement.status !== 'active' || !announcement.isPublic) {
				shouldBeSynced = false;
			}
		}

		const hasCampaignSync = !!(
			(campaign?.content as any)?.version === 1 &&
			(campaign!.content as CampaignContent).items?.[itemId]?.syncs?.[config.id]?.externalId
		);

		const needsSync = shouldBeSynced || !!mapping || hasCampaignSync;
		if (!needsSync) {
			console.log(`[SyncService] Item ${itemId} checkSync skipped: shouldBeSynced=${shouldBeSynced} (targets: [${syncIds.join(', ')}]), hasMapping=${!!mapping}, hasCampaignSync=${hasCampaignSync} for config ${config.id} (${config.providerType})`);
		}

		return {
			needsSync
		};
	}

	/**
	 * Synchronize a single item (push new or update existing mapping)
	 */
	public async executeSyncItem(
		config: SyncConfig,
		provider: SyncProvider,
		itemId: string,
		entityType: 'event' | 'announcement'
	): Promise<void> {
		const table = entityType === 'event' ? eventTable : announcementTable;
		const [itemRow] = await db.select().from(table).where(eq(table.id, itemId));

		if (!itemRow) {
			console.warn(`[SyncService] ${entityType} ${itemId} not found in database.`);
			return;
		}

		// Find campaign for this item
		let campaignId = itemRow.campaignId;
		let campaignRow: typeof campaignTable.$inferSelect | undefined;
		if (campaignId) {
			[campaignRow] = await db.select().from(campaignTable).where(eq(campaignTable.id, campaignId));
		}
		if (!campaignRow && entityType === 'event') {
			const masterId = (itemRow as any).recurringEventId;
			if (masterId) {
				const [master] = await db.select().from(eventTable).where(eq(eventTable.id, masterId));
				if (master?.campaignId) {
					campaignId = master.campaignId;
					[campaignRow] = await db.select().from(campaignTable).where(eq(campaignTable.id, campaignId));
					await db.update(table).set({ campaignId } as any).where(eq(table.id, itemId));
				}
			} else if ((itemRow as any).seriesId) {
				const [master] = await db.select().from(eventTable).where(
					and(
						eq(eventTable.seriesId, (itemRow as any).seriesId),
						isNull(eventTable.recurringEventId)
					)
				);
				if (master?.campaignId) {
					campaignId = master.campaignId;
					[campaignRow] = await db.select().from(campaignTable).where(eq(campaignTable.id, campaignId));
					await db.update(table).set({ campaignId } as any).where(eq(table.id, itemId));
				}
			}
		}

		const mappingWhere = entityType === 'event'
			? and(eq(syncMappingTable.eventId, itemId), eq(syncMappingTable.syncConfigId, config.id))
			: and(eq(syncMappingTable.announcementId, itemId), eq(syncMappingTable.syncConfigId, config.id));

		const [legacyMapping] = await db.select().from(syncMappingTable).where(mappingWhere);

		let campContent: CampaignContent = (campaignRow?.content as any)?.version === 1
			? (campaignRow?.content as any)
			: createDefaultCampaignContent([config.id]);

		const existingItemSync = campContent.items?.[itemId]?.syncs?.[config.id];
		const existingExternalId = existingItemSync?.externalId || legacyMapping?.externalId;

		const externalItem = await this.mapInternalToExternal(itemRow as any, config.providerType);

		let finalExternalId = existingExternalId;
		let finalEtag: string | null | undefined = existingItemSync?.etag || legacyMapping?.etag;

		if (existingExternalId) {
			// Update existing item
			try {
				const { etag } = await provider.updateEvent(existingExternalId, externalItem);
				finalEtag = etag;
			} catch (err: any) {
				if (err?.message?.includes('404')) {
					console.warn(`[SyncService] External item ${existingExternalId} returned 404 on update. Deleting legacy mapping and re-pushing.`);
					if (legacyMapping) {
						await db.delete(syncMappingTable).where(eq(syncMappingTable.id, legacyMapping.id));
					}
					const { externalId, etag } = await provider.pushEvent(externalItem);
					finalExternalId = externalId;
					finalEtag = etag;
				} else {
					throw err;
				}
			}
		} else {
			// Create new item
			const { externalId, etag } = await provider.pushEvent(externalItem);
			finalExternalId = externalId;
			finalEtag = etag;
		}

		if (finalExternalId) {
			campContent.targets[config.id] = { enabled: true };
			if (!campContent.items) campContent.items = {};
			if (!campContent.items[itemId]) campContent.items[itemId] = { entityType, syncs: {} };
			campContent.items[itemId].syncs[config.id] = {
				status: 'synced',
				externalId: finalExternalId,
				etag: finalEtag ?? undefined,
				lastSyncedAt: new Date().toISOString()
			};
			if (!campContent.externalIds) campContent.externalIds = {};
			campContent.externalIds[finalExternalId] = { itemId, configId: config.id };

			if (campaignRow) {
				await db.update(campaignTable).set({ content: campContent, updatedAt: new Date() }).where(eq(campaignTable.id, campaignRow.id));
			} else {
				const [newCamp] = await db.insert(campaignTable).values({
					userId: itemRow.userId || config.userId,
					name: `Campaign for ${(itemRow as any).summary || (itemRow as any).title || itemId}`,
					content: campContent
				}).returning();
				if (newCamp) {
					await db.update(table).set({ campaignId: newCamp.id } as any).where(eq(table.id, itemId));
				}
			}

			// Clean up legacy mapping if one existed, as it is now migrated into campaign
			if (legacyMapping) {
				await db.delete(syncMappingTable).where(eq(syncMappingTable.id, legacyMapping.id));
			}
		}
	}

	/**
	 * Sync a single item to a provider (create, update, or delete)
	 */
	private async syncSingleItem(
		config: SyncConfig,
		provider: SyncProvider,
		itemId: string,
		entityType: 'event' | 'announcement' = 'event'
	): Promise<void> {
		try {
			if (!provider.supportedEntityTypes.includes(entityType)) {
				console.log(`[SyncService] Provider ${config.providerType} does not support entityType ${entityType}. Skipping.`);
				return;
			}

			const table = entityType === 'event' ? eventTable : announcementTable;
			const [itemRow] = await db
				.select()
				.from(table)
				.where(eq(table.id, itemId));

			const mappingWhere = entityType === 'event'
				? and(eq(syncMappingTable.eventId, itemId), eq(syncMappingTable.syncConfigId, config.id))
				: and(eq(syncMappingTable.announcementId, itemId), eq(syncMappingTable.syncConfigId, config.id));

			const [mapping] = await db
				.select()
				.from(syncMappingTable)
				.where(mappingWhere);

			const [itemWithCampaign] = await db
				.select({ campaign: campaignTable })
				.from(table)
				.leftJoin(campaignTable, eq(table.campaignId, campaignTable.id))
				.where(eq(table.id, itemId))
				.limit(1);

			let campaign = itemWithCampaign?.campaign;
			if (!campaign && entityType === 'event') {
				const masterId = (itemRow as any)?.recurringEventId;
				if (masterId) {
					const [master] = await db
						.select({ campaign: campaignTable })
						.from(eventTable)
						.leftJoin(campaignTable, eq(eventTable.campaignId, campaignTable.id))
						.where(eq(eventTable.id, masterId))
						.limit(1);
					if (master?.campaign) {
						campaign = master.campaign;
						await db.update(eventTable).set({ campaignId: master.campaign.id }).where(eq(eventTable.id, itemId));
					}
				} else if ((itemRow as any)?.seriesId) {
					const [master] = await db
						.select({ campaign: campaignTable })
						.from(eventTable)
						.leftJoin(campaignTable, eq(eventTable.campaignId, campaignTable.id))
						.where(and(eq(eventTable.seriesId, (itemRow as any).seriesId), isNull(eventTable.recurringEventId)))
						.limit(1);
					if (master?.campaign) {
						campaign = master.campaign;
						await db.update(eventTable).set({ campaignId: master.campaign.id }).where(eq(eventTable.id, itemId));
					}
				}
			}

			const syncIds = getCampaignTargetIds(campaign?.content);
			const isTargetConfig = syncIds.includes(config.id);
			let shouldBeSynced = isTargetConfig;

			if (entityType === 'event' && shouldBeSynced) {
				if (provider.shouldSyncEvent) {
					if (!provider.shouldSyncEvent(itemRow)) shouldBeSynced = false;
				} else {
					const event = itemRow as any;
					if (event.status === 'tentative' || !event.isPublic) shouldBeSynced = false;
				}
			} else if (entityType === 'announcement' && shouldBeSynced) {
				const ann = itemRow as any;
				if (ann.status !== 'active' || !ann.isPublic) shouldBeSynced = false;
			}

			const campContent = (campaign?.content as any)?.version === 1 ? (campaign!.content as CampaignContent) : null;
			const existingItemSync = campContent?.items?.[itemId]?.syncs?.[config.id];
			const existingExternalId = existingItemSync?.externalId || mapping?.externalId;

			if (!shouldBeSynced && !existingExternalId) {
				console.log(`[SyncService] Skipping ${entityType} ${itemId}: not selected or not eligible for synchronization config ${config.id}`);
				return;
			}

			// Only un-publish if explicitly deselected from campaign targets, or if cancelled
			const isCancelled = (itemRow as any)?.status === 'cancelled';
			if ((!isTargetConfig || isCancelled) && existingExternalId) {
				console.log(`[SyncService] Un-publishing ${entityType} ${itemId} from provider: deselected or cancelled for config ${config.id}`);
				try {
					await provider.deleteEvent(existingExternalId);
					if (mapping) {
						await db.delete(syncMappingTable).where(eq(syncMappingTable.id, mapping.id));
					}
					if (campContent && campContent.items?.[itemId]?.syncs?.[config.id]) {
						delete campContent.items[itemId].syncs[config.id];
						if (campContent.externalIds?.[existingExternalId]) {
							delete campContent.externalIds[existingExternalId];
						}
						await db.update(campaignTable).set({ content: campContent, updatedAt: new Date() }).where(eq(campaignTable.id, campaign!.id));
					}
				} catch (e: any) {
					console.error(`[SyncService] Failed to un-publish ${entityType} ${itemId}:`, e);
				}
				return;
			}

			if (!shouldBeSynced) {
				// Eligible in targets, but skipped by provider-level filter (e.g. past event)
				return;
			}

			if (!itemRow) {
				console.warn(`[SyncService] ${entityType} ${itemId} not found in database.`);
				return;
			}

			console.log(`[SyncService] Syncing ${entityType} ${itemId} ("${(itemRow as any).summary || (itemRow as any).title}") to provider: ${config.providerType}. Status: ${mapping ? 'update' : 'create'}`);
			await this.executeSyncItem(config, provider, itemId, entityType);

		} catch (error: any) {
			console.error(`[SyncService] Failed to sync ${entityType} ${itemId}:`, error);
		}
	}


	/**
	 * Delete event mappings for specific events (called after event deletion)
	 */
	async deleteEventMappings(userId: string, eventIds: string[]): Promise<void> {
		try {
			if (!eventIds || eventIds.length === 0) return;

			// Get all sync configs
			const configs = await db
				.select()
				.from(syncConfigTable);

			const configMap = new Map(configs.map(c => [c.id, this.rowToConfig(c)]));

			// 1. Find campaigns containing these events
			const campaignsToUpdate = await db
				.select()
				.from(campaignTable)
				.where(
					sql`EXISTS (
						SELECT 1 FROM jsonb_object_keys(COALESCE(${campaignTable.content}->'items', '{}'::jsonb)) AS k
						WHERE k = ANY(${eventIds}::text[])
					)`
				);

			for (const camp of campaignsToUpdate) {
				const content = camp.content as CampaignContent;
				if (!content || content.version !== 1 || !content.items) continue;

				for (const eventId of eventIds) {
					const item = content.items[eventId];
					if (!item || !item.syncs) continue;

					for (const [configId, syncState] of Object.entries(item.syncs)) {
						if (syncState.externalId) {
							const config = configMap.get(configId);
							if (config && (config.direction === 'push' || config.direction === 'bidirectional')) {
								try {
									const provider = await this.getProviderInstance(config);
									console.log(`[SyncService] Deleting event ${syncState.externalId} from provider ${config.providerType}`);
									await provider.deleteEvent(syncState.externalId);
								} catch (delErr) {
									console.warn(`[SyncService] Delete error on provider for ${syncState.externalId}:`, delErr);
								}
							}
							if (content.externalIds) {
								delete content.externalIds[syncState.externalId];
							}
						}
					}
					delete content.items[eventId];
				}

				await db.update(campaignTable).set({ content, updatedAt: new Date() }).where(eq(campaignTable.id, camp.id));
			}

			// 2. Also delete legacy mappings from syncMappingTable
			for (const configRow of configs) {
				const config = this.rowToConfig(configRow);
				const mappings = await db
					.select()
					.from(syncMappingTable)
					.where(
						and(
							eq(syncMappingTable.syncConfigId, config.id),
							inArray(syncMappingTable.eventId, eventIds)
						)
					);

				if (mappings.length === 0) continue;

				if (config.direction === 'push' || config.direction === 'bidirectional') {
					try {
						const provider = await this.getProviderInstance(config);
						for (const mapping of mappings) {
							try {
								await provider.deleteEvent(mapping.externalId);
							} catch (error: any) {
								console.error(`[SyncService] Failed to delete event ${mapping.externalId} from provider:`, error);
							}
						}
					} catch (error: any) {
						console.error(`[SyncService] Failed to initialize provider for deletion:`, error);
					}
				}
			}

			await db
				.delete(syncMappingTable)
				.where(inArray(syncMappingTable.eventId, eventIds));
		} catch (error: any) {
			console.error(`[SyncService] Error in deleteEventMappings:`, error);
		}
	}

	/**
	 * Triggered when a resource association to an event changes (link or unlink).
	 */
	async syncResourceAssociationsChange(
		userId: string,
		eventId: string,
		resourceId: string,
		action: 'link' | 'unlink'
	): Promise<void> {
		try {
			if (action === 'unlink') {
				// Remove specific sync_mapping records for this event + resource
				await db
					.delete(syncMappingTable)
					.where(
						and(
							eq(syncMappingTable.eventId, eventId),
							eq(syncMappingTable.resourceId, resourceId)
						)
					);
			}
			// Trigger re-sync of the event so external calendar events update (adding or removing room attendee)
			await this.syncItems(userId, [eventId], 'event');
		} catch (err) {
			console.error(`[SyncService] Failed to sync resource association change (${action}) for event ${eventId}:`, err);
		}
	}

	/**
	 * Triggered when a resource's allocation configuration or resource entity itself changes.
	 */
	async syncResourceConfigChange(userId: string, resourceId: string): Promise<void> {
		try {
			// Find all events associated with this resource
			const linkedEvents = await db
				.select({ eventId: eventResourceTable.eventId })
				.from(eventResourceTable)
				.where(eq(eventResourceTable.resourceId, resourceId));

			const eventIds = Array.from(new Set(linkedEvents.map(e => e.eventId)));
			if (eventIds.length > 0) {
				console.log(`[SyncService] Re-syncing ${eventIds.length} events affected by resource ${resourceId} configuration change.`);
				await this.syncItems(userId, eventIds, 'event');
			}
		} catch (err) {
			console.error(`[SyncService] Failed to sync resource config change for resource ${resourceId}:`, err);
		}
	}

	/**
	 * Cancel webhook for a sync configuration
	 * Stops receiving push notifications from the provider
	 */
	async cancelWebhook(configId: string): Promise<void> {
		try {
			// Get sync config
			const [configRow] = await db
				.select()
				.from(syncConfigTable)
				.where(eq(syncConfigTable.id, configId));

			if (!configRow || !configRow.webhookId) {
				return;
			}

			const config = this.rowToConfig(configRow);

			// Get webhook subscription
			const [subscription] = await db
				.select()
				.from(webhookSubscriptionTable)
				.where(eq(webhookSubscriptionTable.id, configRow.webhookId));

			if (!subscription) {
				return;
			}

			// Initialize provider
			const provider = await this.getProviderInstance(config);

			// Cancel webhook with provider
			if (provider.supportsWebhooks && provider.cancelWebhook) {
				await provider.cancelWebhook(subscription as any);
			}

			// Delete subscription from database
			await db
				.delete(webhookSubscriptionTable)
				.where(eq(webhookSubscriptionTable.id, subscription.id));

			// Clear webhook ID from sync config
			await db
				.update(syncConfigTable)
				.set({ webhookId: null })
				.where(eq(syncConfigTable.id, configId));
		} catch (error: any) {
			console.error(`[SyncService] Failed to cancel webhook:`, error);
			// Don't throw - webhook may have already expired or been deleted
		}
	}

	/**
	 * Trigger push sync for a user
	 * Should be called when a user creates/updates an event locally
	 */
	async triggerPushSync(userId: string, itemId?: string, entityType: 'event' | 'announcement' = 'event'): Promise<void> {
		try {
			if (itemId) {
				// optimized path: sync only the specific item
				await this.syncItems(userId, [itemId], entityType);
				return;
			}


			// Find all enabled sync configs with push direction (Global sweep)
			const configs = await db
				.select()
				.from(syncConfigTable)
				.where(
					eq(syncConfigTable.enabled, true)
				);

			for (const configRow of configs) {
				const config = this.rowToConfig(configRow);
				if (config.direction === 'push' || config.direction === 'bidirectional') {
					// Trigger async sync (background)
					this.syncEvents(config.id).catch((error) => {
						console.error(`[SyncService] Triggered push sync failed for config ${config.id}:`, error);
					});
				}
			}
		} catch (error) {
			console.error(`[SyncService] Failed to trigger push sync for user ${userId}:`, error);
		}
	}

	/**
	 * Get email campaigns by sync configuration ID
	 */
	async getEmailCampaigns(configId: string): Promise<any[]> {
		try {
			const campaigns = await db
				.select()
				.from(emailCampaignTable)
				.where(eq(emailCampaignTable.syncConfigId, configId));
			
			return campaigns.map(c => ({
				...c,
				sentAt: c.sentAt.toISOString()
			}));
		} catch (error) {
			console.error(`[SyncService] Failed to get email campaigns for config ${configId}:`, error);
			return [];
		}
	}
}

// Export singleton instance
export const syncService = new SyncService();
