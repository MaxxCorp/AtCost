ALTER TABLE "location_contact" ADD COLUMN "newsletter_subscribed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "sign_up_mode" text DEFAULT 'off' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_contact" ADD COLUMN "party_size" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "event_contact" ADD COLUMN "notify_on_changes" boolean DEFAULT false NOT NULL;