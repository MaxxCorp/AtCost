ALTER TABLE "kiosk" ADD COLUMN "exclude_non_public" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "kiosk" ADD COLUMN "exclude_tentative" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "kiosk" ADD COLUMN "excluded_event_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "kiosk" ADD COLUMN "included_event_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "kiosk" ADD COLUMN "excluded_announcement_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "kiosk" ADD COLUMN "included_announcement_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "kiosk" ADD COLUMN "excluded_tags" jsonb DEFAULT '["Series"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "kiosk" ADD COLUMN "included_tags" jsonb DEFAULT '[]'::jsonb NOT NULL;