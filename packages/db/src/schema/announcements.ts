import { pgTable, text, timestamp, boolean, uuid, primaryKey } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { contact, tag } from "./contacts";
import { location } from "./resources";
import { campaign } from "./campaigns";

// --- ANNOUNCEMENT TABLES ---

export const announcement = pgTable("announcement", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(() => campaign.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    summary: text("summary"),
    content: text("content").notNull(),
    isPublic: boolean("is_public").default(false).notNull(),
    status: text("status").default("active").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const announcementContact = pgTable("announcement_contact", {
    announcementId: uuid("announcement_id").notNull().references(() => announcement.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").notNull().references(() => contact.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.announcementId, table.contactId] })]);

export const announcementTag = pgTable("announcement_tag", {
    announcementId: uuid("announcement_id").notNull().references(() => announcement.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull().references(() => tag.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.announcementId, table.tagId] })]);

export const announcementLocation = pgTable("announcement_location", {
    announcementId: uuid("announcement_id").notNull().references(() => announcement.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").notNull().references(() => location.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.announcementId, table.locationId] })]);

export type Announcement = typeof announcement.$inferSelect;
export type NewAnnouncement = typeof announcement.$inferInsert;
