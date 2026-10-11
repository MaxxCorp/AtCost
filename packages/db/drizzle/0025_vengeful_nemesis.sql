CREATE TABLE "task_type_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_type" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"lead_time_days" integer DEFAULT 30 NOT NULL,
	"target_roles" jsonb DEFAULT '["admin","hr_manager","top_management"]'::jsonb NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"auto_prompt_differential_update" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_type_config_task_type_unique" UNIQUE("task_type")
);
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "due_date" timestamp;--> statement-breakpoint
ALTER TABLE "union_contract_condition" ADD COLUMN "step_progression_rules" jsonb;--> statement-breakpoint
ALTER TABLE "union_contract_condition" ADD COLUMN "tenure_benefits" jsonb;