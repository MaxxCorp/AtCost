ALTER TABLE "kiosk" ADD COLUMN "ui_mode" text DEFAULT 'carousel' NOT NULL;--> statement-breakpoint
ALTER TABLE "kiosk" ADD COLUMN "range_mode" text DEFAULT 'rolling' NOT NULL;--> statement-breakpoint
ALTER TABLE "kiosk" ADD COLUMN "start_date" timestamp;--> statement-breakpoint
ALTER TABLE "kiosk" ADD COLUMN "end_date" timestamp;