CREATE TABLE "shift_plan_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"location_id" uuid,
	"schedule" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_plan_template_talent" (
	"template_id" uuid NOT NULL,
	"talent_id" uuid NOT NULL,
	CONSTRAINT "shift_plan_template_talent_template_id_talent_id_pk" PRIMARY KEY("template_id","talent_id")
);
--> statement-breakpoint
ALTER TABLE "shift_plan_template" ADD CONSTRAINT "shift_plan_template_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_plan_template_talent" ADD CONSTRAINT "shift_plan_template_talent_template_id_shift_plan_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."shift_plan_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_plan_template_talent" ADD CONSTRAINT "shift_plan_template_talent_talent_id_talent_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talent"("id") ON DELETE cascade ON UPDATE no action;