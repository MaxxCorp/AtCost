ALTER TABLE "menu_item" ADD COLUMN "cost_price" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_item" ADD COLUMN "factor" double precision DEFAULT 2 NOT NULL;