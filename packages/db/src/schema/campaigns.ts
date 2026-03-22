import { pgTable, text, timestamp, uuid, jsonb, integer } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { syncConfig } from "./sync";

// --- CAMPAIGN TABLES ---

export const campaign = pgTable("campaign", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    content: jsonb("content"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

// --- EMAIL TABLES ---

export const emailCampaign = pgTable("email_campaign", {
    id: uuid("id").primaryKey().defaultRandom(),
    syncConfigId: uuid("sync_config_id").notNull().references(() => syncConfig.id, { onDelete: "cascade" }),
    eventId: uuid("event_id"), // Lazy reference
    announcementId: uuid("announcement_id"), // Lazy reference
    eventSummary: text("event_summary").notNull(),
    brevoCampaignId: text("brevo_campaign_id").notNull(),
    sentAt: timestamp("sent_at").notNull(),
    recipientCount: integer("recipient_count").default(0).notNull(),
    metadata: jsonb("metadata"),
});

export const emailEvent = pgTable("email_event", {
    id: uuid("id").primaryKey().defaultRandom(),
    emailCampaignId: uuid("email_campaign_id").notNull().references(() => emailCampaign.id, { onDelete: "cascade" }),
    recipientEmail: text("recipient_email").notNull(),
    eventType: text("event_type").notNull(),
    eventData: jsonb("event_data"),
    occurredAt: timestamp("occurred_at").notNull(),
});

export type Campaign = typeof campaign.$inferSelect;
export type NewCampaign = typeof campaign.$inferInsert;
export type EmailCampaign = typeof emailCampaign.$inferSelect;
export type NewEmailCampaign = typeof emailCampaign.$inferInsert;
export type EmailEvent = typeof emailEvent.$inferSelect;
export type NewEmailEvent = typeof emailEvent.$inferInsert;
