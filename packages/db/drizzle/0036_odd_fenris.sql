ALTER TABLE "event" ADD COLUMN "prep_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "teardown_minutes" integer DEFAULT 0 NOT NULL;