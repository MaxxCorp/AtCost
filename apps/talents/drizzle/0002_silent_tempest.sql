CREATE TABLE "shift_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"talent_id" uuid NOT NULL,
	"location_id" uuid,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheet_audit_trail" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timesheet_entry_id" uuid NOT NULL,
	"changed_by_user_id" text NOT NULL,
	"operation" text NOT NULL,
	"previous_data" jsonb,
	"new_data" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheet_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"talent_id" uuid NOT NULL,
	"shift_plan_id" uuid,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"manager_id" text,
	"manager_comment" text,
	"type" text NOT NULL,
	"location_id" uuid,
	"latitude" double precision,
	"longitude" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shift_plan" ADD CONSTRAINT "shift_plan_talent_id_talent_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_plan" ADD CONSTRAINT "shift_plan_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_audit_trail" ADD CONSTRAINT "timesheet_audit_trail_timesheet_entry_id_timesheet_entry_id_fk" FOREIGN KEY ("timesheet_entry_id") REFERENCES "public"."timesheet_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_audit_trail" ADD CONSTRAINT "timesheet_audit_trail_changed_by_user_id_user_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_entry" ADD CONSTRAINT "timesheet_entry_talent_id_talent_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_entry" ADD CONSTRAINT "timesheet_entry_shift_plan_id_shift_plan_id_fk" FOREIGN KEY ("shift_plan_id") REFERENCES "public"."shift_plan"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_entry" ADD CONSTRAINT "timesheet_entry_manager_id_user_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_entry" ADD CONSTRAINT "timesheet_entry_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shift_plan_talent_id_idx" ON "shift_plan" USING btree ("talent_id");--> statement-breakpoint
CREATE INDEX "shift_plan_location_id_idx" ON "shift_plan" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "timesheet_audit_entry_id_idx" ON "timesheet_audit_trail" USING btree ("timesheet_entry_id");--> statement-breakpoint
CREATE INDEX "timesheet_entry_talent_id_idx" ON "timesheet_entry" USING btree ("talent_id");--> statement-breakpoint
CREATE INDEX "timesheet_entry_status_idx" ON "timesheet_entry" USING btree ("status");