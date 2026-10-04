CREATE TABLE "consumable" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"purchase_price" double precision DEFAULT 0 NOT NULL,
	"unit" text DEFAULT 'piece' NOT NULL,
	"amount" double precision DEFAULT 1 NOT NULL,
	"storage_location" text,
	"expiration_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"instructions" text,
	"portions" double precision DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_consumable" (
	"recipe_id" uuid NOT NULL,
	"consumable_id" uuid NOT NULL,
	"amount" double precision NOT NULL,
	"unit" text,
	CONSTRAINT "recipe_consumable_recipe_id_consumable_id_pk" PRIMARY KEY("recipe_id","consumable_id")
);
--> statement-breakpoint
CREATE TABLE "event_menu" (
	"event_id" uuid NOT NULL,
	"menu_id" uuid NOT NULL,
	CONSTRAINT "event_menu_event_id_menu_id_pk" PRIMARY KEY("event_id","menu_id")
);
--> statement-breakpoint
CREATE TABLE "menu" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_template" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_id" uuid NOT NULL,
	"item_type" text NOT NULL,
	"consumable_id" uuid,
	"recipe_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"portion_amount" double precision DEFAULT 1 NOT NULL,
	"unit" text,
	"unit_price" double precision DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipe_consumable" ADD CONSTRAINT "recipe_consumable_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_consumable" ADD CONSTRAINT "recipe_consumable_consumable_id_consumable_id_fk" FOREIGN KEY ("consumable_id") REFERENCES "public"."consumable"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_menu" ADD CONSTRAINT "event_menu_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_menu" ADD CONSTRAINT "event_menu_menu_id_menu_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."menu"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item" ADD CONSTRAINT "menu_item_menu_id_menu_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."menu"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item" ADD CONSTRAINT "menu_item_consumable_id_consumable_id_fk" FOREIGN KEY ("consumable_id") REFERENCES "public"."consumable"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item" ADD CONSTRAINT "menu_item_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE set null ON UPDATE no action;