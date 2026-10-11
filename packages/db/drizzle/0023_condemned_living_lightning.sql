ALTER TABLE "contract" ADD COLUMN "funding_program" text DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "funding_subsidy_percentage" double precision DEFAULT 100;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "further_training_budget" double precision DEFAULT 3000;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "further_training_used" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "coaching_hours_per_month" double precision DEFAULT 2;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "jobcenter_reference" text;--> statement-breakpoint
ALTER TABLE "payroll_profile" ADD COLUMN "funding_program" text DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "payroll_profile" ADD COLUMN "funding_subsidy_percentage" double precision DEFAULT 100;--> statement-breakpoint
ALTER TABLE "payroll_profile" ADD COLUMN "funding_year" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "payroll_profile" ADD COLUMN "jobcenter_name" text;--> statement-breakpoint
ALTER TABLE "payroll_profile" ADD COLUMN "jobcenter_reference" text;--> statement-breakpoint
ALTER TABLE "payroll_profile" ADD COLUMN "further_training_budget" double precision DEFAULT 3000;--> statement-breakpoint
ALTER TABLE "payroll_profile" ADD COLUMN "further_training_used" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "payroll_profile" ADD COLUMN "coaching_hours_per_month" double precision DEFAULT 2;--> statement-breakpoint
ALTER TABLE "payroll_profile" ADD COLUMN "deuev_personengruppe" text DEFAULT '101';--> statement-breakpoint
ALTER TABLE "payroll_profile" ADD COLUMN "deuev_beitragsgruppe" text DEFAULT '1111';--> statement-breakpoint
ALTER TABLE "payroll_run" ADD COLUMN "total_jobcenter_subsidy" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_run" ADD COLUMN "total_net_employer_cost" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payslip" ADD COLUMN "funding_program" text;--> statement-breakpoint
ALTER TABLE "payslip" ADD COLUMN "jobcenter_subsidy" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payslip" ADD COLUMN "net_employer_cost" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payslip" ADD COLUMN "deuev_personengruppe" text DEFAULT '101';--> statement-breakpoint
ALTER TABLE "payslip" ADD COLUMN "deuev_beitragsgruppe" text DEFAULT '1111';