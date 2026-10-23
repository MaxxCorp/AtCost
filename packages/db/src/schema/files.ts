import { pgTable, text, timestamp, boolean, uuid, jsonb, integer, index, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { event } from "./events";
import { announcement } from "./announcements";
import { syncConfig } from "./sync";

export const file = pgTable("file", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    syncConfigId: uuid("sync_config_id").references(() => syncConfig.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    itemType: text("item_type").default("file").notNull(), // 'file' | 'folder' | 'link' | 'office_doc'
    mimeType: text("mime_type"),
    extension: text("extension"),
    size: integer("size"),
    webUrl: text("web_url"),
    downloadUrl: text("download_url"),
    driveId: text("drive_id"),
    externalItemId: text("external_item_id"),
    parentItemId: text("parent_item_id"),
    folderPath: text("folder_path"),
    isShortcut: boolean("is_shortcut").default(false).notNull(),
    targetUrl: text("target_url"),
    targetDriveId: text("target_drive_id"),
    targetItemId: text("target_item_id"),
    targetType: text("target_type"), // 'file' | 'folder' | 'external_url'
    isArchived: boolean("is_archived").default(false).notNull(),
    etag: text("etag"),
    metadata: jsonb("metadata").$type<Record<string, any>>().default({}).notNull(),
    lastSyncedAt: timestamp("last_synced_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
    index("file_user_id_idx").on(table.userId),
    index("file_sync_config_id_idx").on(table.syncConfigId),
    index("file_drive_item_idx").on(table.driveId, table.externalItemId),
]);

export const eventFile = pgTable("event_file", {
    eventId: uuid("event_id").notNull().references(() => event.id, { onDelete: "cascade" }),
    fileId: uuid("file_id").notNull().references(() => file.id, { onDelete: "cascade" }),
}, (table) => [
    primaryKey({ columns: [table.eventId, table.fileId] })
]);

export const announcementFile = pgTable("announcement_file", {
    announcementId: uuid("announcement_id").notNull().references(() => announcement.id, { onDelete: "cascade" }),
    fileId: uuid("file_id").notNull().references(() => file.id, { onDelete: "cascade" }),
}, (table) => [
    primaryKey({ columns: [table.announcementId, table.fileId] })
]);

export const entityFileFolder = pgTable("entity_file_folder", {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(), // 'event' | 'announcement'
    entityId: uuid("entity_id").notNull(),
    syncConfigId: uuid("sync_config_id").references(() => syncConfig.id, { onDelete: "cascade" }),
    driveId: text("drive_id").notNull(),
    folderItemId: text("folder_item_id").notNull(),
    folderName: text("folder_name").notNull(),
    folderPath: text("folder_path").notNull(),
    webUrl: text("web_url"),
    isArchived: boolean("is_archived").default(false).notNull(),
    deltaToken: text("delta_token"),
    lastSyncedAt: timestamp("last_synced_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
    uniqueIndex("entity_file_folder_entity_idx").on(table.entityType, table.entityId),
]);

export type DbFile = typeof file.$inferSelect;
export type NewDbFile = typeof file.$inferInsert;
export type EventFile = typeof eventFile.$inferSelect;
export type NewEventFile = typeof eventFile.$inferInsert;
export type AnnouncementFile = typeof announcementFile.$inferSelect;
export type NewAnnouncementFile = typeof announcementFile.$inferInsert;
export type EntityFileFolder = typeof entityFileFolder.$inferSelect;
export type NewEntityFileFolder = typeof entityFileFolder.$inferInsert;
