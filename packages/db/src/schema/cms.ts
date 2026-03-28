import { pgTable, text, timestamp, uuid, boolean, integer, primaryKey, jsonb } from "drizzle-orm/pg-core";
import { user } from "./auth";

// --- CMS TABLES ---

export const cmsPage = pgTable("cms_page", {
    slug: text("slug").primaryKey(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cmsBlock = pgTable("cms_block", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    type: text("type"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cmsSlot = pgTable("cms_slot", {
    pageSlug: text("page_slug").notNull().references(() => cmsPage.slug, { onDelete: "cascade" }),
    slotName: text("slot_name").notNull(),
    blockId: uuid("block_id").notNull().references(() => cmsBlock.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").default(true).notNull(),
    order: integer("order").default(0).notNull(),
}, (table) => [
    primaryKey({ columns: [table.pageSlug, table.slotName] }),
]);

export const cmsContentVersion = pgTable("cms_content_version", {
    id: uuid("id").primaryKey().defaultRandom(),
    blockId: uuid("block_id").notNull().references(() => cmsBlock.id, { onDelete: "cascade" }),
    language: text("language").notNull(),
    branch: text("branch").default("published").notNull(),
    content: jsonb("content").notNull(),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cmsMedia = pgTable("cms_media", {
    id: uuid("id").primaryKey().defaultRandom(),
    url: text("url").notNull(),
    path: text("path").notNull(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    userId: text("user_id").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CmsPage = typeof cmsPage.$inferSelect;
export type NewCmsPage = typeof cmsPage.$inferInsert;
export type CmsBlock = typeof cmsBlock.$inferSelect;
export type NewCmsBlock = typeof cmsBlock.$inferInsert;
export type CmsSlot = typeof cmsSlot.$inferSelect;
export type NewCmsSlot = typeof cmsSlot.$inferInsert;
export type CmsContentVersion = typeof cmsContentVersion.$inferSelect;
export type NewCmsContentVersion = typeof cmsContentVersion.$inferInsert;
export type CmsMedia = typeof cmsMedia.$inferSelect;
export type NewCmsMedia = typeof cmsMedia.$inferInsert;
