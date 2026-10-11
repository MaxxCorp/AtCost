ALTER TABLE "contract" ALTER COLUMN "probation_period_months" SET DEFAULT 6;--> statement-breakpoint
ALTER TABLE "contract" ALTER COLUMN "wage_type" SET DEFAULT 'monthly';--> statement-breakpoint
ALTER TABLE "contract" ALTER COLUMN "holiday_allotment_days" SET DEFAULT 30;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "contract_type" text DEFAULT 'base_contract' NOT NULL;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "precedence" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "parent_contract_id" uuid;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "notice_period_rule" text DEFAULT 'tv_standard';--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "custom_notice_period" text;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "work_days_per_week" double precision DEFAULT 5;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "flextime_model" text DEFAULT 'standard';--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "eve_days_free" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "wage_table" text DEFAULT 'AWO Berlin (E-Tabelle)';--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "stufenlaufzeit_months" integer;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "next_stufenaufstieg_date" timestamp;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "overtime_surcharge_percent" double precision DEFAULT 30;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "night_surcharge_percent" double precision DEFAULT 20;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "sunday_surcharge_percent" double precision DEFAULT 25;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "holiday_surcharge_percent" double precision DEFAULT 35;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "saturday_surcharge_percent" double precision DEFAULT 20;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "capital_forming_benefits" double precision DEFAULT 6.65;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "capital_allowance" double precision DEFAULT 150;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "yearly_bonus_percentage" double precision DEFAULT 80;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "yearly_bonus_month" integer DEFAULT 11;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "yearly_bonus_leave_conversion" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "special_leave_days" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "differential_adjustments" jsonb;--> statement-breakpoint
ALTER TABLE "contract" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "contract_framework" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "contract_framework" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contract_framework" ADD COLUMN "default_values" jsonb;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_parent_contract_id_contract_id_fk" FOREIGN KEY ("parent_contract_id") REFERENCES "public"."contract"("id") ON DELETE set null ON UPDATE no action;