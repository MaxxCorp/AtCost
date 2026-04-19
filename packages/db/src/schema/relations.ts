import { relations } from "drizzle-orm";
import { user, session, account, verification } from "./auth";
import { contact, contactEmail, contactPhone, contactAddress, contactRelation, tag, contactTag, userContact } from "./contacts";
import { location, resource, resourceContact, locationContact, resourceLocation, resourceRelation } from "./resources";
import { event, recurringSeries, eventContact, eventLocation, eventResource, eventTag } from "./events";
import { talent, talentTimelineEntry, shiftPlan, timesheetEntry, timesheetAuditTrail, timeOffRequest, timeOffBalance, userTalent, shiftPlanTemplate, shiftPlanTemplateTalent, task } from "./talents";
import { announcement, announcementContact, announcementTag, announcementLocation } from "./announcements";
import { campaign, emailCampaign, emailEvent } from "./campaigns";
import { kiosk, kioskLocation } from "./kiosks";
import { syncConfig, syncOperation, syncMapping, webhookSubscription } from "./sync";
import { cmsPage, cmsBlock, cmsSlot, cmsContentVersion, cmsMedia } from "./cms";
import { contract, contractFramework, contractFrameworkContract } from "./contracts";

export const userRelations = relations(user, ({ many }) => ({
    contacts: many(contact),
    userContacts: many(userContact),
    locations: many(location),
    resources: many(resource),
    events: many(event),
    recurringSeries: many(recurringSeries),
    announcements: many(announcement),
    campaigns: many(campaign),
    kiosks: many(kiosk),
    timesheetAuditTrails: many(timesheetAuditTrail),
    syncConfigs: many(syncConfig),
    timeOffRequests: many(timeOffRequest),
    userTalents: many(userTalent),
}));

export const contactRelations = relations(contact, ({ many }) => ({
    emails: many(contactEmail),
    phones: many(contactPhone),
    addresses: many(contactAddress),
    userAssociations: many(userContact),
    locationAssociations: many(locationContact),
    resourceAssociations: many(resourceContact),
    events: many(eventContact),
    announcements: many(announcementContact),
    relations: many(contactRelation, { relationName: 'fromRelations' }),
    relatedTo: many(contactRelation, { relationName: 'toRelations' }),
    tags: many(contactTag),
    talents: many(talent),
}));

export const contactEmailRelations = relations(contactEmail, ({ one }) => ({
    contact: one(contact, { fields: [contactEmail.contactId], references: [contact.id] }),
}));

export const contactPhoneRelations = relations(contactPhone, ({ one }) => ({
    contact: one(contact, { fields: [contactPhone.contactId], references: [contact.id] }),
}));

export const contactAddressRelations = relations(contactAddress, ({ one }) => ({
    contact: one(contact, { fields: [contactAddress.contactId], references: [contact.id] }),
}));

export const contactRelationRelations = relations(contactRelation, ({ one }) => ({
    contact: one(contact, { fields: [contactRelation.contactId], references: [contact.id], relationName: 'fromRelations' }),
    targetContact: one(contact, { fields: [contactRelation.targetContactId], references: [contact.id], relationName: 'toRelations' }),
}));

export const tagRelations = relations(tag, ({ many }) => ({
    contactAssociations: many(contactTag),
    announcementAssociations: many(announcementTag),
    eventAssociations: many(eventTag),
}));

export const contactTagRelations = relations(contactTag, ({ one }) => ({
    contact: one(contact, { fields: [contactTag.contactId], references: [contact.id] }),
    tag: one(tag, { fields: [contactTag.tagId], references: [tag.id] }),
}));

export const eventRelations = relations(event, ({ many, one }) => ({
    resources: many(eventResource),
    contacts: many(eventContact),
    locations: many(eventLocation),
    tags: many(eventTag),
    series: one(recurringSeries, { fields: [event.seriesId], references: [recurringSeries.id] }),
    user: one(user, { fields: [event.userId], references: [user.id] }),
    campaign: one(campaign, { fields: [event.campaignId], references: [campaign.id] }),
    master: one(event, { fields: [event.recurringEventId], references: [event.id], relationName: 'instances' }),
    instances: many(event, { relationName: 'instances' }),
}));

export const recurringSeriesRelations = relations(recurringSeries, ({ one, many }) => ({
    user: one(user, { fields: [recurringSeries.userId], references: [user.id] }),
    events: many(event),
}));

export const announcementRelations = relations(announcement, ({ many, one }) => ({
    locations: many(announcementLocation),
    contacts: many(announcementContact),
    tags: many(announcementTag),
    user: one(user, { fields: [announcement.userId], references: [user.id] }),
    campaign: one(campaign, { fields: [announcement.campaignId], references: [campaign.id] }),
}));

export const locationRelations = relations(location, ({ many, one }) => ({
    resources: many(resource),
    eventLocations: many(eventLocation),
    announcementLocations: many(announcementLocation),
    kioskLocations: many(kioskLocation),
    resourceLocations: many(resourceLocation),
    locationContacts: many(locationContact),
    user: one(user, { fields: [location.userId], references: [user.id] }),
}));

export const resourceRelations = relations(resource, ({ one, many }) => ({
    location: one(location, { fields: [resource.locationId], references: [location.id] }),
    eventResources: many(eventResource),
    locations: many(resourceLocation),
    resourceContacts: many(resourceContact),
    user: one(user, { fields: [resource.userId], references: [user.id] }),
    parentRelations: many(resourceRelation, { relationName: 'child' }),
    childRelations: many(resourceRelation, { relationName: 'parent' }),
}));

export const resourceRelationRelations = relations(resourceRelation, ({ one }) => ({
    parentResource: one(resource, { fields: [resourceRelation.parentResourceId], references: [resource.id], relationName: 'parent' }),
    childResource: one(resource, { fields: [resourceRelation.childResourceId], references: [resource.id], relationName: 'child' }),
}));

export const talentRelations = relations(talent, ({ one, many }) => ({
    contact: one(contact, { fields: [talent.contactId], references: [contact.id] }),
    timelineEntries: many(talentTimelineEntry),
    shiftPlans: many(shiftPlan),
    timesheetEntries: many(timesheetEntry),
    timeOffRequests: many(timeOffRequest),
    timeOffBalances: many(timeOffBalance),
    userAssociations: many(userTalent),
    shiftPlanTemplates: many(shiftPlanTemplateTalent),
    tasks: many(task, { relationName: 'assignee' }),
    createdTasks: many(task, { relationName: 'creator' }),
    contracts: many(contract),
}));

export const taskRelations = relations(task, ({ one }) => ({
    assignee: one(talent, { fields: [task.assigneeId], references: [talent.id], relationName: 'assignee' }),
    creator: one(talent, { fields: [task.creatorId], references: [talent.id], relationName: 'creator' }),
}));

export const talentTimelineEntryRelations = relations(talentTimelineEntry, ({ one }) => ({
    talent: one(talent, { fields: [talentTimelineEntry.talentId], references: [talent.id] }),
}));

export const shiftPlanRelations = relations(shiftPlan, ({ one, many }) => ({
    talent: one(talent, { fields: [shiftPlan.talentId], references: [talent.id] }),
    location: one(location, { fields: [shiftPlan.locationId], references: [location.id] }),
    timesheetEntries: many(timesheetEntry),
}));

export const shiftPlanTemplateRelations = relations(shiftPlanTemplate, ({ one, many }) => ({
    location: one(location, { fields: [shiftPlanTemplate.locationId], references: [location.id] }),
    talents: many(shiftPlanTemplateTalent),
}));

export const shiftPlanTemplateTalentRelations = relations(shiftPlanTemplateTalent, ({ one }) => ({
    template: one(shiftPlanTemplate, { fields: [shiftPlanTemplateTalent.templateId], references: [shiftPlanTemplate.id] }),
    talent: one(talent, { fields: [shiftPlanTemplateTalent.talentId], references: [talent.id] }),
}));

export const timesheetEntryRelations = relations(timesheetEntry, ({ one, many }) => ({
    talent: one(talent, { fields: [timesheetEntry.talentId], references: [talent.id] }),
    shiftPlan: one(shiftPlan, { fields: [timesheetEntry.shiftPlanId], references: [shiftPlan.id] }),
    manager: one(user, { fields: [timesheetEntry.managerId], references: [user.id] }),
    location: one(location, { fields: [timesheetEntry.locationId], references: [location.id] }),
    auditTrail: many(timesheetAuditTrail),
}));

export const timesheetAuditTrailRelations = relations(timesheetAuditTrail, ({ one }) => ({
    timesheetEntry: one(timesheetEntry, { fields: [timesheetAuditTrail.timesheetEntryId], references: [timesheetEntry.id] }),
    changedByUser: one(user, { fields: [timesheetAuditTrail.changedByUserId], references: [user.id] }),
}));

export const syncConfigRelations = relations(syncConfig, ({ one, many }) => ({
    user: one(user, { fields: [syncConfig.userId], references: [user.id] }),
    operations: many(syncOperation),
    mappings: many(syncMapping),
    webhookSubscriptions: many(webhookSubscription),
}));

export const syncOperationRelations = relations(syncOperation, ({ one }) => ({
    syncConfig: one(syncConfig, { fields: [syncOperation.syncConfigId], references: [syncConfig.id] }),
}));

export const syncMappingRelations = relations(syncMapping, ({ one }) => ({
    syncConfig: one(syncConfig, { fields: [syncMapping.syncConfigId], references: [syncConfig.id] }),
    event: one(event, { fields: [syncMapping.eventId], references: [event.id] }),
    announcement: one(announcement, { fields: [syncMapping.announcementId], references: [announcement.id] }),
    location: one(location, { fields: [syncMapping.locationId], references: [location.id] }),
    contact: one(contact, { fields: [syncMapping.contactId], references: [contact.id] }),
    tag: one(tag, { fields: [syncMapping.tagId], references: [tag.id] }),
    resource: one(resource, { fields: [syncMapping.resourceId], references: [resource.id] }),
}));

export const webhookSubscriptionRelations = relations(webhookSubscription, ({ one }) => ({
    syncConfig: one(syncConfig, { fields: [webhookSubscription.syncConfigId], references: [syncConfig.id] }),
}));

export const userContactRelations = relations(userContact, ({ one }) => ({
    user: one(user, { fields: [userContact.userId], references: [user.id] }),
    contact: one(contact, { fields: [userContact.contactId], references: [contact.id] }),
}));

export const eventContactRelations = relations(eventContact, ({ one }) => ({
    event: one(event, { fields: [eventContact.eventId], references: [event.id] }),
    contact: one(contact, { fields: [eventContact.contactId], references: [contact.id] }),
}));

export const eventLocationRelations = relations(eventLocation, ({ one }) => ({
    event: one(event, { fields: [eventLocation.eventId], references: [event.id] }),
    location: one(location, { fields: [eventLocation.locationId], references: [location.id] }),
}));

export const eventResourceRelations = relations(eventResource, ({ one }) => ({
    event: one(event, { fields: [eventResource.eventId], references: [event.id] }),
    resource: one(resource, { fields: [eventResource.resourceId], references: [resource.id] }),
}));

export const eventTagRelations = relations(eventTag, ({ one }) => ({
    event: one(event, { fields: [eventTag.eventId], references: [event.id] }),
    tag: one(tag, { fields: [eventTag.tagId], references: [tag.id] }),
}));

export const announcementContactRelations = relations(announcementContact, ({ one }) => ({
    announcement: one(announcement, { fields: [announcementContact.announcementId], references: [announcement.id] }),
    contact: one(contact, { fields: [announcementContact.contactId], references: [contact.id] }),
}));

export const announcementTagRelations = relations(announcementTag, ({ one }) => ({
    announcement: one(announcement, { fields: [announcementTag.announcementId], references: [announcement.id] }),
    tag: one(tag, { fields: [announcementTag.tagId], references: [tag.id] }),
}));

export const announcementLocationRelations = relations(announcementLocation, ({ one }) => ({
    announcement: one(announcement, { fields: [announcementLocation.announcementId], references: [announcement.id] }),
    location: one(location, { fields: [announcementLocation.locationId], references: [location.id] }),
}));

export const kioskLocationRelations = relations(kioskLocation, ({ one }) => ({
    kiosk: one(kiosk, { fields: [kioskLocation.kioskId], references: [kiosk.id] }),
    location: one(location, { fields: [kioskLocation.locationId], references: [location.id] }),
}));

export const locationContactRelations = relations(locationContact, ({ one }) => ({
    location: one(location, { fields: [locationContact.locationId], references: [location.id] }),
    contact: one(contact, { fields: [locationContact.contactId], references: [contact.id] }),
}));

export const resourceContactRelations = relations(resourceContact, ({ one }) => ({
    resource: one(resource, { fields: [resourceContact.resourceId], references: [resource.id] }),
    contact: one(contact, { fields: [resourceContact.contactId], references: [contact.id] }),
}));

export const resourceLocationRelations = relations(resourceLocation, ({ one }) => ({
    resource: one(resource, { fields: [resourceLocation.resourceId], references: [resource.id] }),
    location: one(location, { fields: [resourceLocation.locationId], references: [location.id] }),
}));

export const cmsPageRelations = relations(cmsPage, ({ many }) => ({
    slots: many(cmsSlot),
}));

export const cmsBlockRelations = relations(cmsBlock, ({ many }) => ({
    slots: many(cmsSlot),
    versions: many(cmsContentVersion),
}));

export const cmsSlotRelations = relations(cmsSlot, ({ one }) => ({
    page: one(cmsPage, { fields: [cmsSlot.pageSlug], references: [cmsPage.slug] }),
    block: one(cmsBlock, { fields: [cmsSlot.blockId], references: [cmsBlock.id] }),
}));

export const cmsContentVersionRelations = relations(cmsContentVersion, ({ one }) => ({
    block: one(cmsBlock, { fields: [cmsContentVersion.blockId], references: [cmsBlock.id] }),
    author: one(user, { fields: [cmsContentVersion.createdBy], references: [user.id] }),
}));

export const cmsMediaRelations = relations(cmsMedia, ({ one }) => ({
    user: one(user, { fields: [cmsMedia.userId], references: [user.id] }),
}));

export const campaignRelations = relations(campaign, ({ many, one }) => ({
    user: one(user, { fields: [campaign.userId], references: [user.id] }),
    events: many(event),
    announcements: many(announcement),
}));

export const kioskRelations = relations(kiosk, ({ one, many }) => ({
    user: one(user, { fields: [kiosk.userId], references: [user.id] }),
    locations: many(kioskLocation),
}));

export const emailCampaignRelations = relations(emailCampaign, ({ one, many }) => ({
    syncConfig: one(syncConfig, { fields: [emailCampaign.syncConfigId], references: [syncConfig.id] }),
    event: one(event, { fields: [emailCampaign.eventId], references: [event.id] }),
    announcement: one(announcement, { fields: [emailCampaign.announcementId], references: [announcement.id] }),
    events: many(emailEvent),
}));

export const emailEventRelations = relations(emailEvent, ({ one }) => ({
    campaign: one(emailCampaign, { fields: [emailEvent.emailCampaignId], references: [emailCampaign.id] }),
}));
export const timeOffRequestRelations = relations(timeOffRequest, ({ one }) => ({
    talent: one(talent, { fields: [timeOffRequest.talentId], references: [talent.id] }),
    manager: one(user, { fields: [timeOffRequest.managerId], references: [user.id] }),
}));

export const timeOffBalanceRelations = relations(timeOffBalance, ({ one }) => ({
    talent: one(talent, { fields: [timeOffBalance.talentId], references: [talent.id] }),
}));

export const userTalentRelations = relations(userTalent, ({ one }) => ({
    user: one(user, { fields: [userTalent.userId], references: [user.id] }),
    talent: one(talent, { fields: [userTalent.talentId], references: [talent.id] }),
}));

export const contractRelations = relations(contract, ({ one, many }) => ({
    talent: one(talent, { fields: [contract.talentId], references: [talent.id] }),
    frameworks: many(contractFrameworkContract),
}));

export const contractFrameworkRelations = relations(contractFramework, ({ many }) => ({
    contracts: many(contractFrameworkContract),
}));

export const contractFrameworkContractRelations = relations(contractFrameworkContract, ({ one }) => ({
    contract: one(contract, { fields: [contractFrameworkContract.contractId], references: [contract.id] }),
    framework: one(contractFramework, { fields: [contractFrameworkContract.frameworkId], references: [contractFramework.id] }),
}));

