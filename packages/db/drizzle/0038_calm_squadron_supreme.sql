CREATE TABLE "event_sale" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"price_id" uuid,
	"price_item_id" uuid,
	"item_name" text NOT NULL,
	"item_type" text DEFAULT 'consumable' NOT NULL,
	"quantity" double precision DEFAULT 1 NOT NULL,
	"unit_price" double precision DEFAULT 0 NOT NULL,
	"cost_price" double precision DEFAULT 0 NOT NULL,
	"total_revenue" double precision DEFAULT 0 NOT NULL,
	"total_cost" double precision DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"retrieval_mode" text DEFAULT 'fifo' NOT NULL,
	"inventory_deducted" boolean DEFAULT false NOT NULL,
	"deduction_details" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"sold_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_sale" ADD CONSTRAINT "event_sale_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_sale" ADD CONSTRAINT "event_sale_price_id_price_id_fk" FOREIGN KEY ("price_id") REFERENCES "public"."price"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_sale" ADD CONSTRAINT "event_sale_price_item_id_price_item_id_fk" FOREIGN KEY ("price_item_id") REFERENCES "public"."price_item"("id") ON DELETE set null ON UPDATE no action;