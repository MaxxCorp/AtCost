import { pgTable, text, timestamp, boolean, uuid, index, primaryKey } from "drizzle-orm/pg-core";
import { user } from "./auth";

// --- CONTACT TABLES ---

export const contact = pgTable("contact", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    givenName: text("given_name"),
    familyName: text("family_name"),
    middleName: text("middle_name"),
    honorificPrefix: text("honorific_prefix"),
    honorificSuffix: text("honorific_suffix"),
    company: text("company"),
    role: text("role"),
    department: text("department"),
    birthday: timestamp("birthday"),
    gender: text("gender"),
    notes: text("notes"),
    isPublic: boolean("is_public").default(false).notNull(),
    vCardPath: text("vcard_path"),
    qrCodePath: text("qrcode_path"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
    index("contact_user_id_idx").on(table.userId),
]);

export const contactEmail = pgTable("contact_email", {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id").notNull().references(() => contact.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
    type: text("type"),
    primary: boolean("primary").default(false).notNull(),
}, (table) => [
    index("contact_email_contact_id_idx").on(table.contactId),
]);

export const contactPhone = pgTable("contact_phone", {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id").notNull().references(() => contact.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
    type: text("type"),
    primary: boolean("primary").default(false).notNull(),
}, (table) => [
    index("contact_phone_contact_id_idx").on(table.contactId),
]);

export const contactAddress = pgTable("contact_address", {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id").notNull().references(() => contact.id, { onDelete: "cascade" }),
    street: text("street"),
    houseNumber: text("house_number"),
    addressSuffix: text("address_suffix"),
    zip: text("zip"),
    city: text("city"),
    state: text("state"),
    country: text("country"),
    type: text("type"),
    primary: boolean("primary").default(false).notNull(),
}, (table) => [
    index("contact_address_contact_id_idx").on(table.contactId),
]);

export const contactRelation = pgTable("contact_relation", {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id").notNull().references(() => contact.id, { onDelete: "cascade" }),
    targetContactId: uuid("target_contact_id").notNull().references(() => contact.id, { onDelete: "cascade" }),
    relationType: text("relation_type").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
    index("contact_relation_contact_idx").on(table.contactId),
    index("contact_relation_target_idx").on(table.targetContactId),
]);

export const tag = pgTable("tag", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
    index("tag_user_idx").on(table.userId),
    index("tag_name_user_idx").on(table.userId, table.name),
]);

export const contactTag = pgTable("contact_tag", {
    contactId: uuid("contact_id").notNull().references(() => contact.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull().references(() => tag.id, { onDelete: "cascade" }),
}, (table) => [
    primaryKey({ columns: [table.contactId, table.tagId] }),
]);

export const userContact = pgTable("user_contact", {
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").notNull().references(() => contact.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.userId, table.contactId] })]);

export type Contact = typeof contact.$inferSelect;
export type NewContact = typeof contact.$inferInsert;
export type ContactEmail = typeof contactEmail.$inferSelect;
export type NewContactEmail = typeof contactEmail.$inferInsert;
export type ContactPhone = typeof contactPhone.$inferSelect;
export type NewContactPhone = typeof contactPhone.$inferInsert;
export type ContactAddress = typeof contactAddress.$inferSelect;
export type NewContactAddress = typeof contactAddress.$inferInsert;
export type Tag = typeof tag.$inferSelect;
export type NewTag = typeof tag.$inferInsert;
