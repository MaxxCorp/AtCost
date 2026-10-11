ALTER TABLE "payroll_profile" ADD COLUMN "accident_hmo_id" uuid;--> statement-breakpoint
ALTER TABLE "payroll_profile" ADD COLUMN "pension_hmo_id" uuid;--> statement-breakpoint
ALTER TABLE "payroll_profile" ADD COLUMN "u1_compensation_percent" double precision DEFAULT 70;--> statement-breakpoint
ALTER TABLE "payroll_profile" ADD COLUMN "u1_exempt" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "payroll_profile" ADD COLUMN "u3_exempt" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "hmo" ADD COLUMN "category" text DEFAULT 'health' NOT NULL;--> statement-breakpoint
ALTER TABLE "hmo" ADD COLUMN "ik_number" text;--> statement-breakpoint
ALTER TABLE "hmo" ADD COLUMN "betriebsnummer" text;--> statement-breakpoint
ALTER TABLE "hmo" ADD COLUMN "u1_rates" jsonb;--> statement-breakpoint
ALTER TABLE "hmo" ADD COLUMN "u1_default_compensation_percent" double precision DEFAULT 70;--> statement-breakpoint
ALTER TABLE "hmo" ADD COLUMN "u2_rate" double precision DEFAULT 0.44;--> statement-breakpoint
ALTER TABLE "hmo" ADD COLUMN "u3_rate" double precision DEFAULT 0.15;--> statement-breakpoint
ALTER TABLE "hmo" ADD COLUMN "accident_gefahrklasse" double precision;--> statement-breakpoint
ALTER TABLE "hmo" ADD COLUMN "accident_beitragsfuss" double precision;--> statement-breakpoint
ALTER TABLE "hmo" ADD COLUMN "accident_gefahrtarifstelle" text;--> statement-breakpoint
ALTER TABLE "hmo" ADD COLUMN "accident_member_number" text;--> statement-breakpoint
ALTER TABLE "hmo" ADD COLUMN "accident_pin" text;--> statement-breakpoint
ALTER TABLE "hmo" ADD COLUMN "pension_employer_percent" double precision;--> statement-breakpoint
ALTER TABLE "hmo" ADD COLUMN "pension_employee_percent" double precision;--> statement-breakpoint
ALTER TABLE "hmo" ADD COLUMN "pension_member_number" text;--> statement-breakpoint
ALTER TABLE "payroll_profile" ADD CONSTRAINT "payroll_profile_accident_hmo_id_hmo_id_fk" FOREIGN KEY ("accident_hmo_id") REFERENCES "public"."hmo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_profile" ADD CONSTRAINT "payroll_profile_pension_hmo_id_hmo_id_fk" FOREIGN KEY ("pension_hmo_id") REFERENCES "public"."hmo"("id") ON DELETE set null ON UPDATE no action;