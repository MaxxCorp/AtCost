CREATE TABLE "announcement_resource" (
	"announcement_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	CONSTRAINT "announcement_resource_announcement_id_resource_id_pk" PRIMARY KEY("announcement_id","resource_id")
);
--> statement-breakpoint
CREATE TABLE "kiosk_resource" (
	"kiosk_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	CONSTRAINT "kiosk_resource_kiosk_id_resource_id_pk" PRIMARY KEY("kiosk_id","resource_id")
);
--> statement-breakpoint
ALTER TABLE "announcement_resource" ADD CONSTRAINT "announcement_resource_announcement_id_announcement_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_resource" ADD CONSTRAINT "announcement_resource_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kiosk_resource" ADD CONSTRAINT "kiosk_resource_kiosk_id_kiosk_id_fk" FOREIGN KEY ("kiosk_id") REFERENCES "public"."kiosk"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kiosk_resource" ADD CONSTRAINT "kiosk_resource_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;