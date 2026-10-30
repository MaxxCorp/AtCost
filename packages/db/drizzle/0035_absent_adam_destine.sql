CREATE TABLE "location_contact_role" (
	"location_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "location_contact_role_location_id_contact_id_role_id_pk" PRIMARY KEY("location_id","contact_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "announcement_contact_role" (
	"announcement_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "announcement_contact_role_announcement_id_contact_id_role_id_pk" PRIMARY KEY("announcement_id","contact_id","role_id")
);
--> statement-breakpoint
ALTER TABLE "location_contact_role" ADD CONSTRAINT "location_contact_role_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_contact_role" ADD CONSTRAINT "location_contact_role_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_contact_role" ADD CONSTRAINT "location_contact_role_role_id_event_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."event_role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_contact_role" ADD CONSTRAINT "announcement_contact_role_announcement_id_announcement_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_contact_role" ADD CONSTRAINT "announcement_contact_role_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_contact_role" ADD CONSTRAINT "announcement_contact_role_role_id_event_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."event_role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "location_contact_role_idx" ON "location_contact_role" USING btree ("location_id","contact_id");--> statement-breakpoint
CREATE INDEX "announcement_contact_role_idx" ON "announcement_contact_role" USING btree ("announcement_id","contact_id");--> statement-breakpoint
INSERT INTO "event_role" ("name", "color", "is_default") VALUES ('Contact', 'blue', true), ('Kontakt', 'blue', true), ('Responsible', 'emerald', true), ('Verantwortlich', 'emerald', true), ('Moderator', 'amber', true) ON CONFLICT DO NOTHING;
