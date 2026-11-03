ALTER TABLE "event" ADD COLUMN "currency" text DEFAULT 'EUR';--> statement-breakpoint
ALTER TABLE "consumable" ADD COLUMN "currency" text DEFAULT 'EUR';--> statement-breakpoint
ALTER TABLE "price" ADD COLUMN "currency" text DEFAULT 'EUR';