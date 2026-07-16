CREATE TYPE "public"."pixelforge_reference_coverage" AS ENUM('static-visual-fullpage', 'static-visual-partial', 'semantic-only');--> statement-breakpoint
CREATE TYPE "public"."pixelforge_reference_kind" AS ENUM('url', 'image', 'note');--> statement-breakpoint
CREATE TABLE "pixelforge_visual_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" "pixelforge_reference_kind" NOT NULL,
	"label" text NOT NULL,
	"url" text,
	"asset_id" uuid,
	"coverage" "pixelforge_reference_coverage" NOT NULL,
	"fetched_meta" jsonb,
	"analysis" jsonb,
	"weight" integer DEFAULT 1 NOT NULL,
	"note" text,
	"added_by_id" uuid,
	"added_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pixelforge_visual_references" ADD CONSTRAINT "pixelforge_visual_references_project_id_pixelforge_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."pixelforge_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_visual_references" ADD CONSTRAINT "pixelforge_visual_references_asset_id_pixelforge_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."pixelforge_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_visual_references" ADD CONSTRAINT "pixelforge_visual_references_added_by_id_users_id_fk" FOREIGN KEY ("added_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pixelforge_visual_references_project_idx" ON "pixelforge_visual_references" USING btree ("project_id");