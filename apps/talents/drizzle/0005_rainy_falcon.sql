ALTER TABLE "email_campaign" DROP CONSTRAINT "email_campaign_event_id_event_id_fk";
--> statement-breakpoint
ALTER TABLE "email_campaign" DROP CONSTRAINT "email_campaign_announcement_id_announcement_id_fk";
--> statement-breakpoint
ALTER TABLE "sync_mapping" DROP CONSTRAINT "sync_mapping_event_id_event_id_fk";
--> statement-breakpoint
ALTER TABLE "sync_mapping" DROP CONSTRAINT "sync_mapping_announcement_id_announcement_id_fk";
--> statement-breakpoint
ALTER TABLE "sync_mapping" DROP CONSTRAINT "sync_mapping_location_id_location_id_fk";
--> statement-breakpoint
ALTER TABLE "sync_mapping" DROP CONSTRAINT "sync_mapping_contact_id_contact_id_fk";
--> statement-breakpoint
ALTER TABLE "sync_mapping" DROP CONSTRAINT "sync_mapping_tag_id_tag_id_fk";
--> statement-breakpoint
ALTER TABLE "sync_mapping" DROP CONSTRAINT "sync_mapping_resource_id_resource_id_fk";
