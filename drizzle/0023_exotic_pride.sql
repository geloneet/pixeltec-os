CREATE TYPE "public"."pixelforge_direction_status" AS ENUM('candidate', 'chosen', 'discarded');--> statement-breakpoint
CREATE TABLE "pixelforge_creative_directions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"slot" integer NOT NULL,
	"title" text NOT NULL,
	"concept" text NOT NULL,
	"design_tokens" jsonb NOT NULL,
	"motion_dna" jsonb NOT NULL,
	"signature_motif" jsonb NOT NULL,
	"signature_component" jsonb NOT NULL,
	"scores" jsonb NOT NULL,
	"score_total" integer NOT NULL,
	"status" "pixelforge_direction_status" DEFAULT 'candidate' NOT NULL,
	"generation_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pixelforge_projects" ADD COLUMN "chosen_direction_id" uuid;--> statement-breakpoint
ALTER TABLE "pixelforge_creative_directions" ADD CONSTRAINT "pixelforge_creative_directions_project_id_pixelforge_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."pixelforge_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_creative_directions" ADD CONSTRAINT "pixelforge_creative_directions_generation_run_id_pixelforge_ai_runs_id_fk" FOREIGN KEY ("generation_run_id") REFERENCES "public"."pixelforge_ai_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pixelforge_creative_directions_project_idx" ON "pixelforge_creative_directions" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pixelforge_creative_directions_project_slot_idx" ON "pixelforge_creative_directions" USING btree ("project_id","slot");--> statement-breakpoint
ALTER TABLE "pixelforge_projects" ADD CONSTRAINT "pixelforge_projects_chosen_direction_id_pixelforge_creative_directions_id_fk" FOREIGN KEY ("chosen_direction_id") REFERENCES "public"."pixelforge_creative_directions"("id") ON DELETE set null ON UPDATE no action;