import { pgTable, text, timestamp, uuid, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from 'drizzle-orm';
import { user } from "./auth";
import { contact } from "./contacts";

export const talent = pgTable("talent", {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
        .notNull()
        .references(() => contact.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
}, (table) => [
    index("talent_contact_id_idx").on(table.contactId),
]);

export const talentTimelineEntry = pgTable("talent_timeline_entry", {
    id: uuid("id").primaryKey().defaultRandom(),
    talentId: uuid("talent_id")
        .notNull()
        .references(() => talent.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["Interview", "Hiring", "Evaluation", "Termination"] }).notNull(),
    description: text("description"),
    addedByUserId: text("added_by_user_id")
        .notNull()
        .references(() => user.id),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
    
    // Type-specific data
    // { 
    //   date: string, 
    //   comment: string, 
    //   nextStep?: { name: string, date: string, responsibleEmployeeId: string } 
    // }
    data: jsonb("data").$type<{
        date: string;
        comment: string;
        nextStep?: {
            name: string;
            date: string;
            responsibleEmployeeId: string; // References a contact id
        };
    }>(),
}, (table) => [
    index("talent_timeline_talent_id_idx").on(table.talentId),
]);

export const talentRelations = relations(talent, ({ one, many }) => ({
    contact: one(contact, {
        fields: [talent.contactId],
        references: [contact.id],
    }),
    timelineEntries: many(talentTimelineEntry),
}));

export const talentTimelineEntryRelations = relations(talentTimelineEntry, ({ one }) => ({
    talent: one(talent, {
        fields: [talentTimelineEntry.talentId],
        references: [talent.id],
    }),
    addedByUser: one(user, {
        fields: [talentTimelineEntry.addedByUserId],
        references: [user.id],
    }),
}));
