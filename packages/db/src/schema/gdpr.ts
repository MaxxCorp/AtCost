import { pgTable, text, timestamp, uuid, index, jsonb } from "drizzle-orm/pg-core";
import { contact } from "./contacts.js";

export const gdprRequest = pgTable("gdpr_request", {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id").notNull().references(() => contact.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["pending", "obfuscated", "rejected"] }).default("pending").notNull(),
    identifiedFields: jsonb("identified_fields").$type<string[]>().default([]).notNull(),
    requestedAt: timestamp("requested_at").defaultNow().notNull(),
    processedAt: timestamp("processed_at"),
    processedBy: text("processed_by"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
    index("gdpr_request_contact_id_idx").on(table.contactId),
    index("gdpr_request_status_idx").on(table.status),
    index("gdpr_request_created_at_idx").on(table.createdAt),
]);

export type GdprRequest = typeof gdprRequest.$inferSelect;
export type NewGdprRequest = typeof gdprRequest.$inferInsert;
