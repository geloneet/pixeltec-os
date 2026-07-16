CREATE TYPE "public"."pixelforge_artifact_kind" AS ENUM('context_brief', 'landing_dna', 'visual_dna', 'direction_decision', 'narrative_blueprint');--> statement-breakpoint
CREATE TYPE "public"."pixelforge_artifact_status" AS ENUM('pending', 'in_progress', 'sealed', 'invalidated');--> statement-breakpoint
CREATE TYPE "public"."pixelforge_asset_kind" AS ENUM('reference_image', 'export');--> statement-breakpoint
CREATE TYPE "public"."pixelforge_source_type" AS ENUM('note', 'document', 'definition_import', 'url');--> statement-breakpoint
CREATE TYPE "public"."pixelforge_station" AS ENUM('contexto', 'estrategia', 'visual', 'direcciones', 'blueprint', 'produccion', 'qa', 'revision');--> statement-breakpoint
CREATE TYPE "public"."pixelforge_status" AS ENUM('draft', 'in_progress', 'completed', 'approved');--> statement-breakpoint
CREATE TABLE "pixelforge_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" "pixelforge_artifact_kind" NOT NULL,
	"status" "pixelforge_artifact_status" DEFAULT 'pending' NOT NULL,
	"current_draft" jsonb,
	"sealed_content" jsonb,
	"sealed_at" timestamp with time zone,
	"sealed_by_id" uuid,
	"sealed_by_name" text,
	"reopen_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pixelforge_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" "pixelforge_asset_kind" NOT NULL,
	"url" text NOT NULL,
	"r2_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_by_id" uuid,
	"uploaded_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pixelforge_context_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"type" "pixelforge_source_type" NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"url" text,
	"added_by_id" uuid,
	"added_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pixelforge_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"station" "pixelforge_station",
	"type" text NOT NULL,
	"actor_id" uuid,
	"actor_name" text NOT NULL,
	"reason" text,
	"snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pixelforge_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"client_crm_id" text NOT NULL,
	"crm_project_id" text,
	"definition_id" uuid,
	"title" text NOT NULL,
	"brain_dump" text NOT NULL,
	"current_station" "pixelforge_station" DEFAULT 'contexto' NOT NULL,
	"status" "pixelforge_status" DEFAULT 'in_progress' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pixelforge_artifacts" ADD CONSTRAINT "pixelforge_artifacts_project_id_pixelforge_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."pixelforge_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_artifacts" ADD CONSTRAINT "pixelforge_artifacts_sealed_by_id_users_id_fk" FOREIGN KEY ("sealed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_assets" ADD CONSTRAINT "pixelforge_assets_project_id_pixelforge_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."pixelforge_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_assets" ADD CONSTRAINT "pixelforge_assets_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_context_sources" ADD CONSTRAINT "pixelforge_context_sources_project_id_pixelforge_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."pixelforge_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_context_sources" ADD CONSTRAINT "pixelforge_context_sources_added_by_id_users_id_fk" FOREIGN KEY ("added_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_events" ADD CONSTRAINT "pixelforge_events_project_id_pixelforge_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."pixelforge_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_events" ADD CONSTRAINT "pixelforge_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_projects" ADD CONSTRAINT "pixelforge_projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_projects" ADD CONSTRAINT "pixelforge_projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_projects" ADD CONSTRAINT "pixelforge_projects_definition_id_project_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."project_definitions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pixelforge_artifacts_project_kind_idx" ON "pixelforge_artifacts" USING btree ("project_id","kind");--> statement-breakpoint
CREATE INDEX "pixelforge_assets_project_idx" ON "pixelforge_assets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "pixelforge_context_sources_project_idx" ON "pixelforge_context_sources" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "pixelforge_events_project_idx" ON "pixelforge_events" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "pixelforge_projects_owner_idx" ON "pixelforge_projects" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "pixelforge_projects_client_idx" ON "pixelforge_projects" USING btree ("client_id");