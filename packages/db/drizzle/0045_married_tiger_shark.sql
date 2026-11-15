CREATE TABLE "goal_campaign" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"contact_id" uuid,
	"creator_name" text,
	"creator_role" text DEFAULT 'community' NOT NULL,
	"title" text NOT NULL,
	"slug" text,
	"executive_summary" text NOT NULL,
	"description" text NOT NULL,
	"hero_image" text,
	"contribution_type" text DEFAULT 'vote' NOT NULL,
	"primary_target" double precision DEFAULT 100 NOT NULL,
	"current_amount" double precision DEFAULT 0 NOT NULL,
	"contributions_count" integer DEFAULT 0 NOT NULL,
	"visits_count" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"unit_label" text DEFAULT 'votes' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"approval_status" text DEFAULT 'pending' NOT NULL,
	"approval_notes" text,
	"approved_by_user_id" text,
	"approved_at" timestamp with time zone,
	"is_showcased" boolean DEFAULT false NOT NULL,
	"showcase_order" integer DEFAULT 0 NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"plugin_config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_campaign_contact" (
	"campaign_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"role" text DEFAULT 'participant' NOT NULL,
	CONSTRAINT "goal_campaign_contact_campaign_id_contact_id_pk" PRIMARY KEY("campaign_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "goal_campaign_location" (
	"campaign_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	CONSTRAINT "goal_campaign_location_campaign_id_location_id_pk" PRIMARY KEY("campaign_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "goal_campaign_tag" (
	"campaign_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "goal_campaign_tag_campaign_id_tag_id_pk" PRIMARY KEY("campaign_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "goal_contribution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"contact_id" uuid,
	"contributor_name" text,
	"plugin_type" text NOT NULL,
	"amount" double precision DEFAULT 1 NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"comment" text,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"payment_status" text DEFAULT 'not_applicable' NOT NULL,
	"payment_provider" text,
	"payment_reference" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_showcase_config" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"selection_mode" text DEFAULT 'mixed' NOT NULL,
	"max_items" integer DEFAULT 3 NOT NULL,
	"title" text DEFAULT 'Featured Goal Campaigns' NOT NULL,
	"subtitle" text,
	"updated_by_user_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_stage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"stage_type" text DEFAULT 'primary' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"target_amount" double precision NOT NULL,
	"is_reached" boolean DEFAULT false NOT NULL,
	"reached_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_update" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"contact_id" uuid,
	"author_name" text,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"is_milestone" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goal_campaign" ADD CONSTRAINT "goal_campaign_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_campaign_contact" ADD CONSTRAINT "goal_campaign_contact_campaign_id_goal_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."goal_campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_campaign_contact" ADD CONSTRAINT "goal_campaign_contact_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_campaign_location" ADD CONSTRAINT "goal_campaign_location_campaign_id_goal_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."goal_campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_campaign_location" ADD CONSTRAINT "goal_campaign_location_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_campaign_tag" ADD CONSTRAINT "goal_campaign_tag_campaign_id_goal_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."goal_campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_campaign_tag" ADD CONSTRAINT "goal_campaign_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_contribution" ADD CONSTRAINT "goal_contribution_campaign_id_goal_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."goal_campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_contribution" ADD CONSTRAINT "goal_contribution_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_stage" ADD CONSTRAINT "goal_stage_campaign_id_goal_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."goal_campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_update" ADD CONSTRAINT "goal_update_campaign_id_goal_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."goal_campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_update" ADD CONSTRAINT "goal_update_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;