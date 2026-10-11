CREATE TABLE "hmo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"additional_contribution_percent" double precision DEFAULT 2.5 NOT NULL,
	"type" text DEFAULT 'statutory' NOT NULL,
	"website" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payroll_profile" ADD COLUMN "hmo_id" uuid;--> statement-breakpoint
ALTER TABLE "payroll_profile" ADD CONSTRAINT "payroll_profile_hmo_id_hmo_id_fk" FOREIGN KEY ("hmo_id") REFERENCES "public"."hmo"("id") ON DELETE set null ON UPDATE no action;