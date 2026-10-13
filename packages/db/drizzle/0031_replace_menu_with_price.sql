CREATE TABLE "event_price" (
	"event_id" uuid NOT NULL,
	"price_id" uuid NOT NULL,
	CONSTRAINT "event_price_event_id_price_id_pk" PRIMARY KEY("event_id","price_id")
);
--> statement-breakpoint
CREATE TABLE "price" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_template" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"price_id" uuid NOT NULL,
	"item_type" text NOT NULL,
	"consumable_id" uuid,
	"recipe_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"portion_amount" double precision DEFAULT 1 NOT NULL,
	"unit" text,
	"cost_price" double precision DEFAULT 0 NOT NULL,
	"factor" double precision DEFAULT 2 NOT NULL,
	"unit_price" double precision DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "event_menu" CASCADE;--> statement-breakpoint
DROP TABLE "menu" CASCADE;--> statement-breakpoint
DROP TABLE "menu_item" CASCADE;--> statement-breakpoint
ALTER TABLE "event_price" ADD CONSTRAINT "event_price_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_price" ADD CONSTRAINT "event_price_price_id_price_id_fk" FOREIGN KEY ("price_id") REFERENCES "public"."price"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_item" ADD CONSTRAINT "price_item_price_id_price_id_fk" FOREIGN KEY ("price_id") REFERENCES "public"."price"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_item" ADD CONSTRAINT "price_item_consumable_id_consumable_id_fk" FOREIGN KEY ("consumable_id") REFERENCES "public"."consumable"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_item" ADD CONSTRAINT "price_item_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE set null ON UPDATE no action;