import { pgTable, text, timestamp, boolean, uuid, jsonb, integer } from "drizzle-orm/pg-core";
import { user } from "./auth";

// --- SYNC TABLES ---

export const syncConfig = pgTable("sync_config", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    providerId: text("provider_id"),
    providerType: text("provider_type").notNull(),
    direction: text("direction").default("bidirectional").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    credentials: jsonb("credentials"),
    settings: jsonb("settings"),
    status: text("status").default("inactive").notNull(),
    lastSyncAt: timestamp("last_sync_at"),
    nextSyncAt: timestamp("next_sync_at"),
    syncToken: text("sync_token"),
    webhookId: text("webhook_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const syncOperation = pgTable("sync_operation", {
    id: uuid("id").primaryKey().defaultRandom(),
    syncConfigId: uuid("sync_config_id").notNull().references(() => syncConfig.id, { onDelete: "cascade" }),
    operation: text("operation").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    status: text("status").notNull(),
    retryCount: integer("retry_count").default(0).notNull(),
    error: text("error"),
    errorMessage: text("error_message"),
    results: jsonb("results"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const webhookSubscription = pgTable("webhook_subscription", {
    id: uuid("id").primaryKey().defaultRandom(),
    syncConfigId: uuid("sync_config_id").notNull().references(() => syncConfig.id, { onDelete: "cascade" }),
    url: text("url"),
    events: jsonb("events"),
    status: text("status").default("active").notNull(),
    providerId: text("provider_id"),
    resourceId: text("resource_id"),
    channelId: text("channel_id"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Sync Mapping has many foreign keys, many might be circular. 
// I'll keep it here but use text for IDs or lazy references if needed.
// For now, I'll use lazy references(())

export const syncMapping = pgTable("sync_mapping", {
    id: uuid("id").primaryKey().defaultRandom(),
    syncConfigId: uuid("sync_config_id").notNull().references(() => syncConfig.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    eventId: uuid("event_id"), 
    announcementId: uuid("announcement_id"),
    locationId: uuid("location_id"),
    contactId: uuid("contact_id"),
    tagId: uuid("tag_id"),
    resourceId: uuid("resource_id"),
    providerId: text("provider_id"),
    etag: text("etag"),
    metadata: jsonb("metadata"),
    lastSyncedAt: timestamp("last_synced_at").defaultNow().notNull(),
});

export type SyncConfig = typeof syncConfig.$inferSelect;
export type NewSyncConfig = typeof syncConfig.$inferInsert;
export type SyncOperation = typeof syncOperation.$inferSelect;
export type NewSyncOperation = typeof syncOperation.$inferInsert;
export type SyncMapping = typeof syncMapping.$inferSelect;
export type NewSyncMapping = typeof syncMapping.$inferInsert;
export type WebhookSubscription = typeof webhookSubscription.$inferSelect;
export type NewWebhookSubscription = typeof webhookSubscription.$inferInsert;
