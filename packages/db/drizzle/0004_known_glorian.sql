ALTER TABLE "contact" ADD COLUMN "fingerprints" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "fingerprints" jsonb DEFAULT '{}'::jsonb NOT NULL;