ALTER TABLE "payroll_profile" ADD COLUMN "accident_additional_applicable" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "hmo" ADD COLUMN "accident_additional_rate" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "hmo" ADD COLUMN "accident_additional_label" text;