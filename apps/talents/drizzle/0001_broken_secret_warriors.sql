CREATE TABLE "talent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "talent_timeline_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"talent_id" uuid NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"added_by_user_id" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"data" jsonb
);
--> statement-breakpoint
ALTER TABLE "talent" ADD CONSTRAINT "talent_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_timeline_entry" ADD CONSTRAINT "talent_timeline_entry_talent_id_talent_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_timeline_entry" ADD CONSTRAINT "talent_timeline_entry_added_by_user_id_user_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "talent_contact_id_idx" ON "talent" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "talent_timeline_talent_id_idx" ON "talent_timeline_entry" USING btree ("talent_id");