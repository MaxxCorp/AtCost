CREATE TABLE "contract" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"talent_id" uuid NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"probation_period_months" integer,
	"work_hours_per_day" double precision,
	"work_hours_per_week" double precision,
	"work_hours_per_month" double precision,
	"work_hours_per_year" double precision,
	"wage_type" text NOT NULL,
	"wage_amount" double precision,
	"entgeltgruppe" text,
	"erfahrungsstufe" integer,
	"special_payment_rules" jsonb,
	"yearly_bonus" text,
	"holiday_allotment_days" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_framework" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_framework_contract" (
	"contract_id" uuid NOT NULL,
	"framework_id" uuid NOT NULL,
	CONSTRAINT "contract_framework_contract_contract_id_framework_id_pk" PRIMARY KEY("contract_id","framework_id")
);
--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_talent_id_talent_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_framework_contract" ADD CONSTRAINT "contract_framework_contract_contract_id_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contract"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_framework_contract" ADD CONSTRAINT "contract_framework_contract_framework_id_contract_framework_id_fk" FOREIGN KEY ("framework_id") REFERENCES "public"."contract_framework"("id") ON DELETE cascade ON UPDATE no action;