import { pgTable, uuid, index, primaryKey } from "drizzle-orm/pg-core";
import { relations } from 'drizzle-orm';
import { event, recurringSeries } from "./events";
import { resource, location } from "./resources";
import { announcement } from "./announcements";
import { kiosk } from "./kiosks";
import { contact, tag, eventContact, locationContact } from "./contacts";
import { announcementContact, announcementTag } from "./announcements";

/**
 * Event <-> Location Junction
 */
export const eventLocation = pgTable("event_location", {
    eventId: uuid("event_id")
        .notNull()
        .references(() => event.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
        .notNull()
        .references(() => location.id, { onDelete: "cascade" }),
}, (table) => [
    primaryKey({ columns: [table.eventId, table.locationId] }),
    index("event_location_event_idx").on(table.eventId),
    index("event_location_location_idx").on(table.locationId),
]);

/**
 * Event <-> Resource Junction
 */
export const eventResource = pgTable("event_resource", {
    eventId: uuid("event_id")
        .notNull()
        .references(() => event.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
        .notNull()
        .references(() => resource.id, { onDelete: "cascade" }),
}, (table) => [
    primaryKey({ columns: [table.eventId, table.resourceId] }),
    index("event_resource_event_idx").on(table.eventId),
    index("event_resource_resource_idx").on(table.resourceId),
]);

/**
 * Event <-> Tag Junction
 */
export const eventTag = pgTable("event_tag", {
    eventId: uuid("event_id")
        .notNull()
        .references(() => event.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
        .notNull()
        .references(() => tag.id, { onDelete: "cascade" }),
}, (table) => [
    primaryKey({ columns: [table.eventId, table.tagId] }),
    index("event_tag_event_idx").on(table.eventId),
    index("event_tag_tag_idx").on(table.tagId),
]);

/**
 * Announcement <-> Location Junction
 */
export const announcementLocation = pgTable("announcement_location", {
    announcementId: uuid("announcement_id")
        .notNull()
        .references(() => announcement.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
        .notNull()
        .references(() => location.id, { onDelete: "cascade" }),
}, (table) => [
    primaryKey({ columns: [table.announcementId, table.locationId] }),
    index("announcement_location_announcement_idx").on(table.announcementId),
    index("announcement_location_location_idx").on(table.locationId),
]);

/**
 * Kiosk <-> Location Junction
 */
export const kioskLocation = pgTable("kiosk_location", {
    kioskId: uuid("kiosk_id")
        .notNull()
        .references(() => kiosk.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
        .notNull()
        .references(() => location.id, { onDelete: "cascade" }),
}, (table) => [
    primaryKey({ columns: [table.kioskId, table.locationId] }),
    index("kiosk_location_kiosk_idx").on(table.kioskId),
    index("kiosk_location_location_idx").on(table.locationId),
]);

/**
 * Resource <-> Location Junction
 */
export const resourceLocation = pgTable("resource_location", {
    resourceId: uuid("resource_id")
        .notNull()
        .references(() => resource.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
        .notNull()
        .references(() => location.id, { onDelete: "cascade" }),
}, (table) => [
    primaryKey({ columns: [table.resourceId, table.locationId] }),
    index("resource_location_resource_idx").on(table.resourceId),
    index("resource_location_location_idx").on(table.locationId),
]);

// --- RELATIONS ---

export const eventRelations = relations(event, ({ many, one }) => ({
    resources: many(eventResource),
    contacts: many(eventContact), // FIXED: should point to the junction table
    locations: many(eventLocation),
    tags: many(eventTag),
    series: one(recurringSeries, {
        fields: [event.seriesId],
        references: [recurringSeries.id],
    }),
}));

export const locationRelations = relations(location, ({ many }) => ({
    resources: many(resource),
    eventLocations: many(eventLocation),
    announcementLocations: many(announcementLocation),
    kioskLocations: many(kioskLocation),
    resourceLocations: many(resourceLocation),
    locationContacts: many(locationContact),
}));

export const resourceRelations = relations(resource, ({ one, many }) => ({
    location: one(location, {
        fields: [resource.locationId],
        references: [location.id],
    }),
    eventResources: many(eventResource),
    locations: many(resourceLocation),
}));

export const announcementRelations = relations(announcement, ({ many }) => ({
    locations: many(announcementLocation),
    contacts: many(announcementContact), // Added
    tags: many(announcementTag), // Added
}));

export const kioskRelations = relations(kiosk, ({ many }) => ({
    locations: many(kioskLocation),
}));

export const eventLocationRelations = relations(eventLocation, ({ one }) => ({
    event: one(event, {
        fields: [eventLocation.eventId],
        references: [event.id],
    }),
    location: one(location, {
        fields: [eventLocation.locationId],
        references: [location.id],
    }),
}));

export const eventResourceRelations = relations(eventResource, ({ one }) => ({
    event: one(event, {
        fields: [eventResource.eventId],
        references: [event.id],
    }),
    resource: one(resource, {
        fields: [eventResource.resourceId],
        references: [resource.id],
    }),
}));

export const announcementLocationRelations = relations(announcementLocation, ({ one }) => ({
    announcement: one(announcement, {
        fields: [announcementLocation.announcementId],
        references: [announcement.id],
    }),
    location: one(location, {
        fields: [announcementLocation.locationId],
        references: [location.id],
    }),
}));

export const kioskLocationRelations = relations(kioskLocation, ({ one }) => ({
    kiosk: one(kiosk, {
        fields: [kioskLocation.kioskId],
        references: [kiosk.id],
    }),
    location: one(location, {
        fields: [kioskLocation.locationId],
        references: [location.id],
    }),
}));

export const announcementTagRelations = relations(announcementTag, ({ one }) => ({
    announcement: one(announcement, {
        fields: [announcementTag.announcementId],
        references: [announcement.id],
    }),
    tag: one(tag, {
        fields: [announcementTag.tagId],
        references: [tag.id],
    }),
}));

export const announcementContactRelations = relations(announcementContact, ({ one }) => ({
    announcement: one(announcement, {
        fields: [announcementContact.announcementId],
        references: [announcement.id],
    }),
    contact: one(contact, {
        fields: [announcementContact.contactId],
        references: [contact.id],
    }),
}));

export const resourceLocationRelations = relations(resourceLocation, ({ one }) => ({
    resource: one(resource, {
        fields: [resourceLocation.resourceId],
        references: [resource.id],
    }),
    location: one(location, {
        fields: [resourceLocation.locationId],
        references: [location.id],
    }),
}));
