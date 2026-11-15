import { pgTable, text, timestamp, boolean, uuid, integer, doublePrecision, jsonb, primaryKey } from "drizzle-orm/pg-core";
import { contact, tag } from "./contacts";
import { location } from "./resources";

export type GoalFinancialContributionMode = "pledge_only" | "transfer_only" | "both";
export type GoalFinancialContributionKind = "pledge" | "transfer";

export interface GoalPluginConfig {
    // Vote plugin config
    voteStatement?: string;
    allowComments?: boolean;
    // Sign-up plugin config
    commitmentDescription?: string;
    maxPartySize?: number;
    collectAvailability?: boolean;
    // Financial plugin config
    paymentProvider?: "stripe" | "mollie" | "adyen";
    financialMode?: GoalFinancialContributionMode;
    captureStrategy?: "all_or_nothing" | "immediate";
    suggestedTiers?: Array<{
        amount: number;
        label: string;
        rewardDescription?: string;
    }>;
    allowCustomAmount?: boolean;
    minContribution?: number;
}

export type GoalCampaignStatus =
    | "draft"
    | "pending_approval"
    | "published"
    | "completed_successful"
    | "completed_unsuccessful"
    | "cancelled";

export type GoalApprovalStatus =
    | "not_required"
    | "pending"
    | "approved"
    | "rejected";

export type GoalContributionType = "vote" | "signup" | "financial";

export type GoalShowcaseSelectionMode =
    | "operator_choice"
    | "popularity"
    | "recency"
    | "mixed";

// --- GOAL CAMPAIGN TABLES ---

export const goalCampaign = pgTable("goal_campaign", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    contactId: uuid("contact_id").references(() => contact.id, { onDelete: "set null" }),
    creatorName: text("creator_name"),
    creatorRole: text("creator_role").$type<"operator" | "community">().default("community").notNull(),
    title: text("title").notNull(),
    slug: text("slug"),
    executiveSummary: text("executive_summary").notNull(),
    description: text("description").notNull(),
    heroImage: text("hero_image"),
    contributionType: text("contribution_type").$type<GoalContributionType>().default("vote").notNull(),
    primaryTarget: doublePrecision("primary_target").default(100).notNull(),
    currentAmount: doublePrecision("current_amount").default(0).notNull(),
    contributionsCount: integer("contributions_count").default(0).notNull(),
    visitsCount: integer("visits_count").default(0).notNull(),
    currency: text("currency").default("EUR").notNull(),
    unitLabel: text("unit_label").default("votes").notNull(),
    status: text("status").$type<GoalCampaignStatus>().default("draft").notNull(),
    approvalStatus: text("approval_status").$type<GoalApprovalStatus>().default("pending").notNull(),
    approvalNotes: text("approval_notes"),
    approvedByUserId: text("approved_by_user_id"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    isShowcased: boolean("is_showcased").default(false).notNull(),
    showcaseOrder: integer("showcase_order").default(0).notNull(),
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    pluginConfig: jsonb("plugin_config").$type<GoalPluginConfig>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const goalStage = pgTable("goal_stage", {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").notNull().references(() => goalCampaign.id, { onDelete: "cascade" }),
    stageType: text("stage_type").$type<"primary" | "stretch">().default("primary").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    targetAmount: doublePrecision("target_amount").notNull(),
    isReached: boolean("is_reached").default(false).notNull(),
    reachedAt: timestamp("reached_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const goalContribution = pgTable("goal_contribution", {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").notNull().references(() => goalCampaign.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    contactId: uuid("contact_id").references(() => contact.id, { onDelete: "set null" }),
    contributorName: text("contributor_name"),
    pluginType: text("plugin_type").$type<GoalContributionType>().notNull(),
    amount: doublePrecision("amount").default(1).notNull(),
    currency: text("currency").default("EUR").notNull(),
    comment: text("comment"),
    isAnonymous: boolean("is_anonymous").default(false).notNull(),
    paymentStatus: text("payment_status")
        .$type<
            | "not_applicable"
            | "pending"
            | "pledged"
            | "authorized"
            | "transferred"
            | "captured"
            | "cancelled"
            | "refunded"
            | "failed"
        >()
        .default("not_applicable")
        .notNull(),
    paymentProvider: text("payment_provider"),
    paymentReference: text("payment_reference"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const goalUpdate = pgTable("goal_update", {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").notNull().references(() => goalCampaign.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull(),
    contactId: uuid("contact_id").references(() => contact.id, { onDelete: "set null" }),
    authorName: text("author_name"),
    title: text("title").notNull(),
    content: text("content").notNull(),
    isMilestone: boolean("is_milestone").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const goalCampaignLocation = pgTable("goal_campaign_location", {
    campaignId: uuid("campaign_id").notNull().references(() => goalCampaign.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").notNull().references(() => location.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.campaignId, table.locationId] })]);

export const goalCampaignTag = pgTable("goal_campaign_tag", {
    campaignId: uuid("campaign_id").notNull().references(() => goalCampaign.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull().references(() => tag.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.campaignId, table.tagId] })]);

export const goalCampaignContact = pgTable("goal_campaign_contact", {
    campaignId: uuid("campaign_id").notNull().references(() => goalCampaign.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").notNull().references(() => contact.id, { onDelete: "cascade" }),
    role: text("role").default("participant").notNull(),
}, (table) => [primaryKey({ columns: [table.campaignId, table.contactId] })]);

export const goalShowcaseConfig = pgTable("goal_showcase_config", {
    id: text("id").primaryKey().default("default"),
    isActive: boolean("is_active").default(true).notNull(),
    selectionMode: text("selection_mode").$type<GoalShowcaseSelectionMode>().default("mixed").notNull(),
    maxItems: integer("max_items").default(3).notNull(),
    title: text("title").default("Featured Goal Campaigns").notNull(),
    subtitle: text("subtitle"),
    updatedByUserId: text("updated_by_user_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type GoalCampaign = typeof goalCampaign.$inferSelect;
export type NewGoalCampaign = typeof goalCampaign.$inferInsert;
export type GoalStage = typeof goalStage.$inferSelect;
export type NewGoalStage = typeof goalStage.$inferInsert;
export type GoalContribution = typeof goalContribution.$inferSelect;
export type NewGoalContribution = typeof goalContribution.$inferInsert;
export type GoalUpdate = typeof goalUpdate.$inferSelect;
export type NewGoalUpdate = typeof goalUpdate.$inferInsert;
export type GoalShowcaseConfig = typeof goalShowcaseConfig.$inferSelect;
export type NewGoalShowcaseConfig = typeof goalShowcaseConfig.$inferInsert;
