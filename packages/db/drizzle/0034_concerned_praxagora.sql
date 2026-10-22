CREATE TABLE "gdpr_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"identified_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"processed_by" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "obfuscation_status" text;--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "obfuscation_requested_at" timestamp;--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "obfuscated_at" timestamp;--> statement-breakpoint
ALTER TABLE "gdpr_request" ADD CONSTRAINT "gdpr_request_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gdpr_request_contact_id_idx" ON "gdpr_request" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "gdpr_request_status_idx" ON "gdpr_request" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gdpr_request_created_at_idx" ON "gdpr_request" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "contact_obfuscation_status_idx" ON "contact" USING btree ("obfuscation_status");