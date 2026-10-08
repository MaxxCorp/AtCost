CREATE TABLE "event_contact_role" (
	"event_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "event_contact_role_event_id_contact_id_role_id_pk" PRIMARY KEY("event_id","contact_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "event_role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'blue' NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_role_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "event_contact_role" ADD CONSTRAINT "event_contact_role_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_contact_role" ADD CONSTRAINT "event_contact_role_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_contact_role" ADD CONSTRAINT "event_contact_role_role_id_event_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."event_role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_contact_role_event_contact_idx" ON "event_contact_role" USING btree ("event_id","contact_id");--> statement-breakpoint
INSERT INTO "event_role" ("name", "color", "is_default") VALUES ('Participant', 'slate', true), ('Main Contact', 'blue', true), ('Project Manager', 'purple', true) ON CONFLICT DO NOTHING;