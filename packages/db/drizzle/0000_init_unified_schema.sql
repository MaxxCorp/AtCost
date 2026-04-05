CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"roles" jsonb,
	"claims" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text,
	"given_name" text,
	"family_name" text,
	"middle_name" text,
	"honorific_prefix" text,
	"honorific_suffix" text,
	"company" text,
	"role" text,
	"department" text,
	"birthday" timestamp,
	"gender" text,
	"notes" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"vcard_path" text,
	"qrcode_path" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_address" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"street" text,
	"house_number" text,
	"address_suffix" text,
	"zip" text,
	"city" text,
	"state" text,
	"country" text,
	"type" text,
	"primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_email" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"value" text NOT NULL,
	"type" text,
	"primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_phone" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"value" text NOT NULL,
	"type" text,
	"primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_relation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"target_contact_id" uuid NOT NULL,
	"relation_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_tag" (
	"contact_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "contact_tag_contact_id_tag_id_pk" PRIMARY KEY("contact_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_contact" (
	"user_id" text NOT NULL,
	"contact_id" uuid NOT NULL,
	CONSTRAINT "user_contact_user_id_contact_id_pk" PRIMARY KEY("user_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "location" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"room_id" text,
	"capacity" text,
	"street" text,
	"house_number" text,
	"address_suffix" text,
	"zip" text,
	"city" text,
	"state" text,
	"country" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"inclusivity_support" text,
	"hero_image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location_contact" (
	"location_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	CONSTRAINT "location_contact_location_id_contact_id_pk" PRIMARY KEY("location_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "resource" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"location_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"max_occupancy" integer,
	"allocation_calendars" jsonb,
	"inventory_number" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_contact" (
	"resource_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	CONSTRAINT "resource_contact_resource_id_contact_id_pk" PRIMARY KEY("resource_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "resource_location" (
	"resource_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	CONSTRAINT "resource_location_resource_id_location_id_pk" PRIMARY KEY("resource_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "resource_relation" (
	"parent_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"type" text NOT NULL,
	CONSTRAINT "resource_relation_parent_id_child_id_pk" PRIMARY KEY("parent_id","child_id")
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"series_id" uuid,
	"summary" text NOT NULL,
	"description" text,
	"location" text,
	"start_date_time" timestamp,
	"start_time_zone" text,
	"end_date_time" timestamp,
	"end_time_zone" text,
	"is_all_day" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"recurrence" jsonb,
	"recurring_event_id" uuid,
	"original_start_time" jsonb,
	"is_exception" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"guests_can_invite_others" boolean DEFAULT true NOT NULL,
	"guests_can_modify" boolean DEFAULT false NOT NULL,
	"guests_can_see_other_guests" boolean DEFAULT true NOT NULL,
	"campaign_id" uuid,
	"ticket_price" text,
	"category_berlin_de" text,
	"qrcode_path" text,
	"ical_path" text,
	"ical_uid" text,
	"hero_image" text,
	"attendees" jsonb,
	"reminders" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_contact" (
	"event_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"participation_status" text DEFAULT 'needsAction' NOT NULL,
	CONSTRAINT "event_contact_event_id_contact_id_pk" PRIMARY KEY("event_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "event_location" (
	"event_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	CONSTRAINT "event_location_event_id_location_id_pk" PRIMARY KEY("event_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "event_resource" (
	"event_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	CONSTRAINT "event_resource_event_id_resource_id_pk" PRIMARY KEY("event_id","resource_id")
);
--> statement-breakpoint
CREATE TABLE "event_tag" (
	"event_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "event_tag_event_id_tag_id_pk" PRIMARY KEY("event_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "recurring_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"rrule" text NOT NULL,
	"anchor_date" timestamp NOT NULL,
	"anchor_end_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"campaign_id" uuid,
	"title" text NOT NULL,
	"summary" text,
	"content" text NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcement_contact" (
	"announcement_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	CONSTRAINT "announcement_contact_announcement_id_contact_id_pk" PRIMARY KEY("announcement_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "announcement_location" (
	"announcement_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	CONSTRAINT "announcement_location_announcement_id_location_id_pk" PRIMARY KEY("announcement_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "announcement_tag" (
	"announcement_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "announcement_tag_announcement_id_tag_id_pk" PRIMARY KEY("announcement_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "campaign" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"content" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_campaign" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sync_config_id" uuid NOT NULL,
	"event_id" uuid,
	"announcement_id" uuid,
	"event_summary" text NOT NULL,
	"brevo_campaign_id" text NOT NULL,
	"sent_at" timestamp NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "email_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_campaign_id" uuid NOT NULL,
	"recipient_email" text NOT NULL,
	"event_type" text NOT NULL,
	"event_data" jsonb,
	"occurred_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kiosk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'offline' NOT NULL,
	"range_mode" text DEFAULT 'relative' NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"look_ahead" integer DEFAULT 604800 NOT NULL,
	"look_past" integer DEFAULT 86400 NOT NULL,
	"loop_duration" integer DEFAULT 30 NOT NULL,
	"ui_mode" text DEFAULT 'carousel' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kiosk_location" (
	"kiosk_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	CONSTRAINT "kiosk_location_kiosk_id_location_id_pk" PRIMARY KEY("kiosk_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "sync_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"provider_id" text,
	"provider_type" text NOT NULL,
	"direction" text DEFAULT 'bidirectional' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"credentials" jsonb,
	"settings" jsonb,
	"status" text DEFAULT 'inactive' NOT NULL,
	"last_sync_at" timestamp,
	"next_sync_at" timestamp,
	"sync_token" text,
	"webhook_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_mapping" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sync_config_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"event_id" uuid,
	"announcement_id" uuid,
	"location_id" uuid,
	"contact_id" uuid,
	"tag_id" uuid,
	"resource_id" uuid,
	"provider_id" text,
	"etag" text,
	"metadata" jsonb,
	"last_synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_operation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sync_config_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"status" text NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"error_message" text,
	"results" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sync_config_id" uuid NOT NULL,
	"url" text,
	"events" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"provider_id" text,
	"resource_id" text,
	"channel_id" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"talent_id" uuid NOT NULL,
	"location_id" uuid,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "talent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"status" text DEFAULT 'applicant' NOT NULL,
	"job_title" text,
	"salary_expectation" text,
	"availability_date" timestamp,
	"onboarding_status" text,
	"resume_url" text,
	"source" text,
	"internal_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "talent_timeline_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"talent_id" uuid NOT NULL,
	"added_by_user_id" text,
	"title" text NOT NULL,
	"description" text,
	"date" timestamp NOT NULL,
	"type" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_off_balance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"talent_id" uuid NOT NULL,
	"year" double precision NOT NULL,
	"total_days" double precision NOT NULL,
	"used_days" double precision DEFAULT 0 NOT NULL,
	"pending_days" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_off_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"talent_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"reason" text,
	"manager_id" text,
	"manager_comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheet_audit_trail" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timesheet_entry_id" uuid NOT NULL,
	"changed_by_user_id" text NOT NULL,
	"operation" text NOT NULL,
	"previous_data" jsonb,
	"new_data" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheet_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"talent_id" uuid NOT NULL,
	"shift_plan_id" uuid,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"manager_id" text,
	"manager_comment" text,
	"type" text NOT NULL,
	"location_id" uuid,
	"latitude" double precision,
	"longitude" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_talent" (
	"user_id" text NOT NULL,
	"talent_id" uuid NOT NULL,
	CONSTRAINT "user_talent_user_id_talent_id_pk" PRIMARY KEY("user_id","talent_id")
);
--> statement-breakpoint
CREATE TABLE "cms_block" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_content_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_id" uuid NOT NULL,
	"language" text NOT NULL,
	"branch" text DEFAULT 'published' NOT NULL,
	"content" jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"path" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_page" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_slot" (
	"page_slug" text NOT NULL,
	"slot_name" text NOT NULL,
	"block_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "cms_slot_page_slug_slot_name_pk" PRIMARY KEY("page_slug","slot_name")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_address" ADD CONSTRAINT "contact_address_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_email" ADD CONSTRAINT "contact_email_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_phone" ADD CONSTRAINT "contact_phone_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_relation" ADD CONSTRAINT "contact_relation_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_relation" ADD CONSTRAINT "contact_relation_target_contact_id_contact_id_fk" FOREIGN KEY ("target_contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_tag" ADD CONSTRAINT "contact_tag_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_tag" ADD CONSTRAINT "contact_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_contact" ADD CONSTRAINT "user_contact_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_contact" ADD CONSTRAINT "user_contact_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_contact" ADD CONSTRAINT "location_contact_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_contact" ADD CONSTRAINT "location_contact_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_contact" ADD CONSTRAINT "resource_contact_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_contact" ADD CONSTRAINT "resource_contact_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_location" ADD CONSTRAINT "resource_location_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_location" ADD CONSTRAINT "resource_location_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_relation" ADD CONSTRAINT "resource_relation_parent_id_resource_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_relation" ADD CONSTRAINT "resource_relation_child_id_resource_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_series_id_recurring_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."recurring_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_recurring_event_id_event_id_fk" FOREIGN KEY ("recurring_event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_contact" ADD CONSTRAINT "event_contact_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_contact" ADD CONSTRAINT "event_contact_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_location" ADD CONSTRAINT "event_location_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_location" ADD CONSTRAINT "event_location_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_resource" ADD CONSTRAINT "event_resource_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_resource" ADD CONSTRAINT "event_resource_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_tag" ADD CONSTRAINT "event_tag_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_tag" ADD CONSTRAINT "event_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_series" ADD CONSTRAINT "recurring_series_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_contact" ADD CONSTRAINT "announcement_contact_announcement_id_announcement_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_contact" ADD CONSTRAINT "announcement_contact_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_location" ADD CONSTRAINT "announcement_location_announcement_id_announcement_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_location" ADD CONSTRAINT "announcement_location_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_tag" ADD CONSTRAINT "announcement_tag_announcement_id_announcement_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_tag" ADD CONSTRAINT "announcement_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_campaign" ADD CONSTRAINT "email_campaign_sync_config_id_sync_config_id_fk" FOREIGN KEY ("sync_config_id") REFERENCES "public"."sync_config"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_event" ADD CONSTRAINT "email_event_email_campaign_id_email_campaign_id_fk" FOREIGN KEY ("email_campaign_id") REFERENCES "public"."email_campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kiosk" ADD CONSTRAINT "kiosk_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kiosk_location" ADD CONSTRAINT "kiosk_location_kiosk_id_kiosk_id_fk" FOREIGN KEY ("kiosk_id") REFERENCES "public"."kiosk"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kiosk_location" ADD CONSTRAINT "kiosk_location_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_config" ADD CONSTRAINT "sync_config_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_mapping" ADD CONSTRAINT "sync_mapping_sync_config_id_sync_config_id_fk" FOREIGN KEY ("sync_config_id") REFERENCES "public"."sync_config"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_operation" ADD CONSTRAINT "sync_operation_sync_config_id_sync_config_id_fk" FOREIGN KEY ("sync_config_id") REFERENCES "public"."sync_config"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_subscription" ADD CONSTRAINT "webhook_subscription_sync_config_id_sync_config_id_fk" FOREIGN KEY ("sync_config_id") REFERENCES "public"."sync_config"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_plan" ADD CONSTRAINT "shift_plan_talent_id_talent_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_plan" ADD CONSTRAINT "shift_plan_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent" ADD CONSTRAINT "talent_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_timeline_entry" ADD CONSTRAINT "talent_timeline_entry_talent_id_talent_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_timeline_entry" ADD CONSTRAINT "talent_timeline_entry_added_by_user_id_user_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_balance" ADD CONSTRAINT "time_off_balance_talent_id_talent_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_request" ADD CONSTRAINT "time_off_request_talent_id_talent_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_request" ADD CONSTRAINT "time_off_request_manager_id_user_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_audit_trail" ADD CONSTRAINT "timesheet_audit_trail_timesheet_entry_id_timesheet_entry_id_fk" FOREIGN KEY ("timesheet_entry_id") REFERENCES "public"."timesheet_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_audit_trail" ADD CONSTRAINT "timesheet_audit_trail_changed_by_user_id_user_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_entry" ADD CONSTRAINT "timesheet_entry_talent_id_talent_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_entry" ADD CONSTRAINT "timesheet_entry_shift_plan_id_shift_plan_id_fk" FOREIGN KEY ("shift_plan_id") REFERENCES "public"."shift_plan"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_entry" ADD CONSTRAINT "timesheet_entry_manager_id_user_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_entry" ADD CONSTRAINT "timesheet_entry_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_talent" ADD CONSTRAINT "user_talent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_talent" ADD CONSTRAINT "user_talent_talent_id_talent_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_content_version" ADD CONSTRAINT "cms_content_version_block_id_cms_block_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."cms_block"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_content_version" ADD CONSTRAINT "cms_content_version_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_media" ADD CONSTRAINT "cms_media_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_slot" ADD CONSTRAINT "cms_slot_page_slug_cms_page_slug_fk" FOREIGN KEY ("page_slug") REFERENCES "public"."cms_page"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_slot" ADD CONSTRAINT "cms_slot_block_id_cms_block_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."cms_block"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_provider_id_idx" ON "account" USING btree ("user_id","provider_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "contact_user_id_idx" ON "contact" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "contact_address_contact_id_idx" ON "contact_address" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "contact_email_contact_id_idx" ON "contact_email" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "contact_phone_contact_id_idx" ON "contact_phone" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "contact_relation_contact_idx" ON "contact_relation" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "contact_relation_target_idx" ON "contact_relation" USING btree ("target_contact_id");--> statement-breakpoint
CREATE INDEX "tag_user_idx" ON "tag" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tag_name_user_idx" ON "tag" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "event_user_id_idx" ON "event" USING btree ("user_id");