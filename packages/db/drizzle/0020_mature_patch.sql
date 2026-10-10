CREATE TABLE "shift_scheduling_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"color" text DEFAULT 'purple' NOT NULL,
	"location_id" uuid,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shift_plan" ALTER COLUMN "talent_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_mapping" ADD COLUMN "shift_plan_id" uuid;--> statement-breakpoint
ALTER TABLE "shift_plan" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "shift_plan" ADD COLUMN "scheduling_group_id" uuid;--> statement-breakpoint
ALTER TABLE "shift_plan" ADD COLUMN "theme" text DEFAULT 'blue' NOT NULL;--> statement-breakpoint
ALTER TABLE "shift_plan" ADD COLUMN "is_shared" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "shift_plan" ADD COLUMN "open_slot_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "shift_plan" ADD COLUMN "activities" jsonb;--> statement-breakpoint
ALTER TABLE "shift_plan" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "shift_plan" ADD COLUMN "sync_status" text;--> statement-breakpoint
ALTER TABLE "shift_plan" ADD COLUMN "synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "shift_scheduling_group" ADD CONSTRAINT "shift_scheduling_group_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_plan" ADD CONSTRAINT "shift_plan_scheduling_group_id_shift_scheduling_group_id_fk" FOREIGN KEY ("scheduling_group_id") REFERENCES "public"."shift_scheduling_group"("id") ON DELETE set null ON UPDATE no action;