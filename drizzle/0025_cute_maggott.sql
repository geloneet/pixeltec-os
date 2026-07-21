CREATE TYPE "public"."pixelforge_qa_browser_status" AS ENUM('pending', 'running', 'succeeded', 'failed', 'timed_out', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."pixelforge_qa_run_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."pixelforge_qa_severity" AS ENUM('critical', 'major', 'minor', 'info');--> statement-breakpoint
CREATE TYPE "public"."pixelforge_qa_verdict" AS ENUM('pass', 'pass_with_warnings', 'fail');--> statement-breakpoint
ALTER TYPE "public"."pixelforge_asset_kind" ADD VALUE 'qa_screenshot';--> statement-breakpoint
CREATE TABLE "pixelforge_qa_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"qa_run_id" uuid NOT NULL,
	"check_code" text NOT NULL,
	"category" text NOT NULL,
	"severity" "pixelforge_qa_severity" NOT NULL,
	"blocking" boolean NOT NULL,
	"source" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"recommendation" text NOT NULL,
	"evidence" jsonb,
	"location" jsonb,
	"location_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pixelforge_qa_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"page_version_id" uuid NOT NULL,
	"status" "pixelforge_qa_run_status" DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"current_phase" text,
	"browser_status" "pixelforge_qa_browser_status" DEFAULT 'pending' NOT NULL,
	"browser_claimed_at" timestamp with time zone,
	"browser_finished_at" timestamp with time zone,
	"verdict" "pixelforge_qa_verdict",
	"score_total" integer,
	"category_scores" jsonb,
	"summary" jsonb,
	"catalog_version" text NOT NULL,
	"scoring_version" text NOT NULL,
	"engine" jsonb,
	"critique_run_id" uuid,
	"originality_run_id" uuid,
	"likeness_run_id" uuid,
	"human_decision" text,
	"human_decision_by_id" uuid,
	"human_decision_by_name" text,
	"human_decision_at" timestamp with time zone,
	"human_decision_reason" text,
	"failure_kind" text,
	"error" text,
	"requested_by_id" uuid,
	"requested_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "pixelforge_qa_findings" ADD CONSTRAINT "pixelforge_qa_findings_qa_run_id_pixelforge_qa_runs_id_fk" FOREIGN KEY ("qa_run_id") REFERENCES "public"."pixelforge_qa_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_qa_runs" ADD CONSTRAINT "pixelforge_qa_runs_project_id_pixelforge_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."pixelforge_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_qa_runs" ADD CONSTRAINT "pixelforge_qa_runs_page_version_id_pixelforge_page_versions_id_fk" FOREIGN KEY ("page_version_id") REFERENCES "public"."pixelforge_page_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_qa_runs" ADD CONSTRAINT "pixelforge_qa_runs_critique_run_id_pixelforge_ai_runs_id_fk" FOREIGN KEY ("critique_run_id") REFERENCES "public"."pixelforge_ai_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_qa_runs" ADD CONSTRAINT "pixelforge_qa_runs_originality_run_id_pixelforge_ai_runs_id_fk" FOREIGN KEY ("originality_run_id") REFERENCES "public"."pixelforge_ai_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_qa_runs" ADD CONSTRAINT "pixelforge_qa_runs_likeness_run_id_pixelforge_ai_runs_id_fk" FOREIGN KEY ("likeness_run_id") REFERENCES "public"."pixelforge_ai_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_qa_runs" ADD CONSTRAINT "pixelforge_qa_runs_human_decision_by_id_users_id_fk" FOREIGN KEY ("human_decision_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_qa_runs" ADD CONSTRAINT "pixelforge_qa_runs_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pixelforge_qa_findings_qa_run_idx" ON "pixelforge_qa_findings" USING btree ("qa_run_id");--> statement-breakpoint
CREATE INDEX "pixelforge_qa_findings_qa_run_severity_idx" ON "pixelforge_qa_findings" USING btree ("qa_run_id","severity");--> statement-breakpoint
CREATE INDEX "pixelforge_qa_findings_qa_run_category_idx" ON "pixelforge_qa_findings" USING btree ("qa_run_id","category");--> statement-breakpoint
CREATE UNIQUE INDEX "pixelforge_qa_findings_dedupe_idx" ON "pixelforge_qa_findings" USING btree ("qa_run_id","check_code","location_key");--> statement-breakpoint
CREATE INDEX "pixelforge_qa_runs_project_idx" ON "pixelforge_qa_runs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "pixelforge_qa_runs_page_version_idx" ON "pixelforge_qa_runs" USING btree ("page_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pixelforge_qa_runs_active_idx" ON "pixelforge_qa_runs" USING btree ("project_id") WHERE "pixelforge_qa_runs"."status" in ('queued','running');