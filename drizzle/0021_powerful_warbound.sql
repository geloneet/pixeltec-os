CREATE TYPE "public"."pixelforge_run_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "pixelforge_ai_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"status" "pixelforge_run_status" DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"current_step" text,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"tokens_in" integer,
	"tokens_out" integer,
	"duration_ms" integer,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"failure_kind" text,
	"error" text,
	"input_summary" jsonb,
	"result_ref" text,
	"user_decision" text,
	"requested_by_id" uuid,
	"requested_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pixelforge_artifacts" ADD COLUMN "last_run_id" uuid;--> statement-breakpoint
ALTER TABLE "pixelforge_ai_runs" ADD CONSTRAINT "pixelforge_ai_runs_project_id_pixelforge_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."pixelforge_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_ai_runs" ADD CONSTRAINT "pixelforge_ai_runs_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pixelforge_ai_runs_project_idx" ON "pixelforge_ai_runs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "pixelforge_ai_runs_project_operation_idx" ON "pixelforge_ai_runs" USING btree ("project_id","operation");--> statement-breakpoint
ALTER TABLE "pixelforge_artifacts" ADD CONSTRAINT "pixelforge_artifacts_last_run_id_pixelforge_ai_runs_id_fk" FOREIGN KEY ("last_run_id") REFERENCES "public"."pixelforge_ai_runs"("id") ON DELETE set null ON UPDATE no action;