CREATE TABLE "tag_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"description" text,
	"color" text DEFAULT 'indigo' NOT NULL,
	"icon" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "talent_tag" (
	"talent_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "talent_tag_talent_id_tag_id_pk" PRIMARY KEY("talent_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "tag" ADD COLUMN "visibility" text DEFAULT 'internal' NOT NULL;--> statement-breakpoint
ALTER TABLE "tag" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "tag" ADD COLUMN "color" text DEFAULT 'indigo' NOT NULL;--> statement-breakpoint
ALTER TABLE "tag" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "payroll_run" ADD COLUMN "target_group" text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_run" ADD COLUMN "tag_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_run" ADD COLUMN "cycle_type" text DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_run" ADD COLUMN "payment_due_date" timestamp;--> statement-breakpoint
ALTER TABLE "talent_tag" ADD CONSTRAINT "talent_tag_talent_id_talent_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_tag" ADD CONSTRAINT "talent_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_category_id_tag_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."tag_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tag_category_idx" ON "tag" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "tag_visibility_idx" ON "tag" USING btree ("visibility");