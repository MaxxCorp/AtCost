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
ALTER TABLE "cms_content_version" DROP CONSTRAINT "cms_content_version_created_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "event" DROP CONSTRAINT "event_series_id_recurring_series_id_fk";
--> statement-breakpoint
ALTER TABLE "resource_relation" DROP CONSTRAINT "resource_relation_parent_resource_id_resource_id_fk";
--> statement-breakpoint
ALTER TABLE "resource_relation" DROP CONSTRAINT "resource_relation_child_resource_id_resource_id_fk";
--> statement-breakpoint
DROP INDEX "announcement_user_id_idx";--> statement-breakpoint
DROP INDEX "announcement_contact_announcement_idx";--> statement-breakpoint
DROP INDEX "announcement_contact_contact_idx";--> statement-breakpoint
DROP INDEX "announcement_tag_announcement_idx";--> statement-breakpoint
DROP INDEX "announcement_tag_tag_idx";--> statement-breakpoint
DROP INDEX "campaign_user_id_idx";--> statement-breakpoint
DROP INDEX "email_campaign_sync_config_id_idx";--> statement-breakpoint
DROP INDEX "email_campaign_event_id_idx";--> statement-breakpoint
DROP INDEX "email_campaign_announcement_id_idx";--> statement-breakpoint
DROP INDEX "email_campaign_sent_at_idx";--> statement-breakpoint
DROP INDEX "email_event_campaign_id_idx";--> statement-breakpoint
DROP INDEX "email_event_recipient_email_idx";--> statement-breakpoint
DROP INDEX "email_event_type_idx";--> statement-breakpoint
DROP INDEX "email_event_occurred_at_idx";--> statement-breakpoint
DROP INDEX "cms_content_version_lookup_idx";--> statement-breakpoint
DROP INDEX "contact_tag_contact_idx";--> statement-breakpoint
DROP INDEX "contact_tag_tag_idx";--> statement-breakpoint
DROP INDEX "event_contact_event_idx";--> statement-breakpoint
DROP INDEX "event_contact_contact_idx";--> statement-breakpoint
DROP INDEX "location_contact_location_idx";--> statement-breakpoint
DROP INDEX "location_contact_contact_idx";--> statement-breakpoint
DROP INDEX "resource_contact_resource_idx";--> statement-breakpoint
DROP INDEX "resource_contact_contact_idx";--> statement-breakpoint
DROP INDEX "user_contact_user_idx";--> statement-breakpoint
DROP INDEX "user_contact_contact_idx";--> statement-breakpoint
DROP INDEX "event_series_id_idx";--> statement-breakpoint
DROP INDEX "recurring_series_user_id_idx";--> statement-breakpoint
DROP INDEX "location_user_id_idx";--> statement-breakpoint
DROP INDEX "resource_user_id_idx";--> statement-breakpoint
DROP INDEX "resource_location_id_idx";--> statement-breakpoint
DROP INDEX "resource_relation_parent_idx";--> statement-breakpoint
DROP INDEX "resource_relation_child_idx";--> statement-breakpoint
DROP INDEX "sync_config_user_id_idx";--> statement-breakpoint
DROP INDEX "sync_mapping_event_id_idx";--> statement-breakpoint
DROP INDEX "sync_mapping_location_id_idx";--> statement-breakpoint
DROP INDEX "sync_mapping_contact_id_idx";--> statement-breakpoint
DROP INDEX "sync_mapping_tag_id_idx";--> statement-breakpoint
DROP INDEX "sync_mapping_announcement_id_idx";--> statement-breakpoint
DROP INDEX "sync_mapping_sync_config_id_idx";--> statement-breakpoint
DROP INDEX "sync_mapping_lookup_index";--> statement-breakpoint
DROP INDEX "sync_operation_config_id_idx";--> statement-breakpoint
DROP INDEX "sync_operation_config_started_idx";--> statement-breakpoint
DROP INDEX "webhook_subscription_sync_config_id_idx";--> statement-breakpoint
DROP INDEX "webhook_subscription_expires_at_idx";--> statement-breakpoint
DROP INDEX "kiosk_user_id_idx";--> statement-breakpoint
DROP INDEX "announcement_location_announcement_idx";--> statement-breakpoint
DROP INDEX "announcement_location_location_idx";--> statement-breakpoint
DROP INDEX "event_location_event_idx";--> statement-breakpoint
DROP INDEX "event_location_location_idx";--> statement-breakpoint
DROP INDEX "event_resource_event_idx";--> statement-breakpoint
DROP INDEX "event_resource_resource_idx";--> statement-breakpoint
DROP INDEX "event_tag_event_idx";--> statement-breakpoint
DROP INDEX "event_tag_tag_idx";--> statement-breakpoint
DROP INDEX "kiosk_location_kiosk_idx";--> statement-breakpoint
DROP INDEX "kiosk_location_location_idx";--> statement-breakpoint
DROP INDEX "resource_location_resource_idx";--> statement-breakpoint
DROP INDEX "resource_location_location_idx";--> statement-breakpoint
ALTER TABLE "resource_relation" DROP CONSTRAINT "resource_relation_parent_resource_id_child_resource_id_pk";--> statement-breakpoint
ALTER TABLE "campaign" ALTER COLUMN "content" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "email_campaign" ALTER COLUMN "brevo_campaign_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "email_campaign" ALTER COLUMN "sent_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "email_campaign" ALTER COLUMN "recipient_count" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "cms_content_version" ALTER COLUMN "branch" SET DEFAULT 'published';--> statement-breakpoint
ALTER TABLE "event" ALTER COLUMN "start_date_time" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ALTER COLUMN "is_exception" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ALTER COLUMN "recurring_event_id" SET DATA TYPE uuid USING recurring_event_id::uuid;--> statement-breakpoint
ALTER TABLE "event" ALTER COLUMN "guests_can_invite_others" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ALTER COLUMN "guests_can_modify" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ALTER COLUMN "guests_can_see_other_guests" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "event" ALTER COLUMN "guests_can_see_other_guests" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "location" ALTER COLUMN "is_public" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "sync_config" ALTER COLUMN "provider_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_config" ALTER COLUMN "direction" SET DEFAULT 'bidirectional';--> statement-breakpoint
ALTER TABLE "sync_mapping" ALTER COLUMN "provider_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_operation" ALTER COLUMN "entity_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_operation" ALTER COLUMN "started_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "sync_operation" ALTER COLUMN "started_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_subscription" ALTER COLUMN "provider_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_subscription" ALTER COLUMN "resource_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_subscription" ALTER COLUMN "channel_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_subscription" ALTER COLUMN "expires_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "kiosk" ALTER COLUMN "loop_duration" SET DEFAULT 30;--> statement-breakpoint
ALTER TABLE "kiosk" ALTER COLUMN "look_ahead" SET DEFAULT 604800;--> statement-breakpoint
ALTER TABLE "kiosk" ALTER COLUMN "look_past" SET DEFAULT 86400;--> statement-breakpoint
ALTER TABLE "kiosk" ALTER COLUMN "range_mode" SET DEFAULT 'relative';--> statement-breakpoint
ALTER TABLE "resource_relation" ADD CONSTRAINT "resource_relation_parent_id_child_id_pk" PRIMARY KEY("parent_id","child_id");--> statement-breakpoint
ALTER TABLE "announcement" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "announcement" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "cms_block" ADD COLUMN "type" text;--> statement-breakpoint
ALTER TABLE "cms_block" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "cms_page" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "cms_slot" ADD COLUMN "order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "ticket_price" text;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "category_berlin_de" text;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "qrcode_path" text;--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN "capacity" text;--> statement-breakpoint
ALTER TABLE "resource" ADD COLUMN "status" text DEFAULT 'available' NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_relation" ADD COLUMN "parent_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_relation" ADD COLUMN "child_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_relation" ADD COLUMN "type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_config" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_config" ADD COLUMN "status" text DEFAULT 'inactive' NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_mapping" ADD COLUMN "resource_id" uuid;--> statement-breakpoint
ALTER TABLE "sync_operation" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "sync_operation" ADD COLUMN "results" jsonb;--> statement-breakpoint
ALTER TABLE "sync_operation" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_subscription" ADD COLUMN "url" text;--> statement-breakpoint
ALTER TABLE "webhook_subscription" ADD COLUMN "events" jsonb;--> statement-breakpoint
ALTER TABLE "webhook_subscription" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "kiosk" ADD COLUMN "status" text DEFAULT 'offline' NOT NULL;--> statement-breakpoint
ALTER TABLE "shift_plan" ADD CONSTRAINT "shift_plan_talent_id_talent_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_plan" ADD CONSTRAINT "shift_plan_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent" ADD CONSTRAINT "talent_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_timeline_entry" ADD CONSTRAINT "talent_timeline_entry_talent_id_talent_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_timeline_entry" ADD CONSTRAINT "talent_timeline_entry_added_by_user_id_user_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_audit_trail" ADD CONSTRAINT "timesheet_audit_trail_timesheet_entry_id_timesheet_entry_id_fk" FOREIGN KEY ("timesheet_entry_id") REFERENCES "public"."timesheet_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_audit_trail" ADD CONSTRAINT "timesheet_audit_trail_changed_by_user_id_user_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_entry" ADD CONSTRAINT "timesheet_entry_talent_id_talent_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_entry" ADD CONSTRAINT "timesheet_entry_shift_plan_id_shift_plan_id_fk" FOREIGN KEY ("shift_plan_id") REFERENCES "public"."shift_plan"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_entry" ADD CONSTRAINT "timesheet_entry_manager_id_user_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_entry" ADD CONSTRAINT "timesheet_entry_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_content_version" ADD CONSTRAINT "cms_content_version_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_recurring_event_id_event_id_fk" FOREIGN KEY ("recurring_event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_series_id_recurring_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."recurring_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_relation" ADD CONSTRAINT "resource_relation_parent_id_resource_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_relation" ADD CONSTRAINT "resource_relation_child_id_resource_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_event" DROP COLUMN "created_at";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "google_event_id";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "google_calendar_id";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "etag";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "html_link";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "color_id";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "categoryBerlinDotDe";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "ticketPrice";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "event_type";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "end_time_unspecified";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "visibility";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "transparency";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "creator";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "organizer";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "attendees_omitted";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "anyone_can_add_self";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "conference_data";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "hangout_link";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "attachments";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "extended_properties";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "working_location_properties";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "out_of_office_properties";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "focus_time_properties";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "birthday_properties";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "source";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "locked";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "private_copy";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "sequence";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "qr_code_path";--> statement-breakpoint
ALTER TABLE "location" DROP COLUMN "latitude";--> statement-breakpoint
ALTER TABLE "location" DROP COLUMN "longitude";--> statement-breakpoint
ALTER TABLE "location" DROP COLUMN "what3words";--> statement-breakpoint
ALTER TABLE "resource_relation" DROP COLUMN "parent_resource_id";--> statement-breakpoint
ALTER TABLE "resource_relation" DROP COLUMN "child_resource_id";--> statement-breakpoint
ALTER TABLE "sync_operation" DROP COLUMN "external_id";--> statement-breakpoint
ALTER TABLE "kiosk" DROP COLUMN "ui_mode";