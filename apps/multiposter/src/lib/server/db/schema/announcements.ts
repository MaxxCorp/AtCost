import { pgTable, text, timestamp, boolean, uuid, index, primaryKey } from "drizzle-orm/pg-core";
import { relations } from 'drizzle-orm';
import { user } from "./auth";

import { tag } from "./contacts"; // Reusing tag from contacts or should I move tag to a shared place? tag is in contacts.ts
import { contact } from "./contacts";

export const announcement = pgTable("announcement", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),

    title: text("title").notNull(),
    content: text("content").notNull(),

    isPublic: boolean("is_public").default(false).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
}, (table) => [
    index("announcement_user_id_idx").on(table.userId),
]);

export const announcementTag = pgTable("announcement_tag", {
    announcementId: uuid("announcement_id")
        .notNull()
        .references(() => announcement.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
        .notNull()
        .references(() => tag.id, { onDelete: "cascade" }),
}, (table) => [
    primaryKey({ columns: [table.announcementId, table.tagId] }),
    index("announcement_tag_announcement_idx").on(table.announcementId),
    index("announcement_tag_tag_idx").on(table.tagId),
]);

export const announcementContact = pgTable("announcement_contact", {
    announcementId: uuid("announcement_id")
        .notNull()
        .references(() => announcement.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
        .notNull()
        .references(() => contact.id, { onDelete: "cascade" }),
}, (table) => [
    primaryKey({ columns: [table.announcementId, table.contactId] }),
    index("announcement_contact_announcement_idx").on(table.announcementId),
    index("announcement_contact_contact_idx").on(table.contactId),
]);



export type Announcement = typeof announcement.$inferSelect;
export type NewAnnouncement = typeof announcement.$inferInsert;
