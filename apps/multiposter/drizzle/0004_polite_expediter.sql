CREATE TABLE "resource_location" (
	"resource_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	CONSTRAINT "resource_location_resource_id_location_id_pk" PRIMARY KEY("resource_id","location_id")
);
--> statement-breakpoint
ALTER TABLE "resource_location" ADD CONSTRAINT "resource_location_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_location" ADD CONSTRAINT "resource_location_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resource_location_resource_idx" ON "resource_location" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "resource_location_location_idx" ON "resource_location" USING btree ("location_id");