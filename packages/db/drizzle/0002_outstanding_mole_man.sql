CREATE TABLE "task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"assignee_id" uuid NOT NULL,
	"creator_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_assignee_id_talent_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."talent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_creator_id_talent_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."talent"("id") ON DELETE set null ON UPDATE no action;