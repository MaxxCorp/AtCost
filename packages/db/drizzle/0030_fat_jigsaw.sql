CREATE TABLE "consumable_tag" (
	"consumable_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "consumable_tag_consumable_id_tag_id_pk" PRIMARY KEY("consumable_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "recipe_tag" (
	"recipe_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "recipe_tag_recipe_id_tag_id_pk" PRIMARY KEY("recipe_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "consumable_tag" ADD CONSTRAINT "consumable_tag_consumable_id_consumable_id_fk" FOREIGN KEY ("consumable_id") REFERENCES "public"."consumable"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumable_tag" ADD CONSTRAINT "consumable_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_tag" ADD CONSTRAINT "recipe_tag_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_tag" ADD CONSTRAINT "recipe_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;