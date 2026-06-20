ALTER TABLE "event" ALTER COLUMN "end_date_time" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ALTER COLUMN "end_time_zone" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ALTER COLUMN "status" SET DEFAULT 'tentative';--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "internal_notes" text;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "ticket_price_unknown" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "location";