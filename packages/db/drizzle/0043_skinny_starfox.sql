ALTER TABLE "event" ADD COLUMN "sign_up_closure_date" timestamp;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "sign_up_contact_id" uuid;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "sign_up_contact_overridden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_sign_up_contact_id_contact_id_fk" FOREIGN KEY ("sign_up_contact_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;