ALTER TABLE "account" DROP CONSTRAINT "account_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "session" DROP CONSTRAINT "session_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "contact" DROP CONSTRAINT "contact_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "tag" DROP CONSTRAINT "tag_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "user_contact" DROP CONSTRAINT "user_contact_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "location" DROP CONSTRAINT "location_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "resource" DROP CONSTRAINT "resource_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "event" DROP CONSTRAINT "event_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "recurring_series" DROP CONSTRAINT "recurring_series_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "announcement" DROP CONSTRAINT "announcement_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "campaign" DROP CONSTRAINT "campaign_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "kiosk" DROP CONSTRAINT "kiosk_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "sync_config" DROP CONSTRAINT "sync_config_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "talent_timeline_entry" DROP CONSTRAINT "talent_timeline_entry_added_by_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "time_off_request" DROP CONSTRAINT "time_off_request_manager_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "timesheet_audit_trail" DROP CONSTRAINT "timesheet_audit_trail_changed_by_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "timesheet_entry" DROP CONSTRAINT "timesheet_entry_manager_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "user_talent" DROP CONSTRAINT "user_talent_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "cms_content_version" DROP CONSTRAINT "cms_content_version_created_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "cms_media" DROP CONSTRAINT "cms_media_user_id_user_id_fk";
