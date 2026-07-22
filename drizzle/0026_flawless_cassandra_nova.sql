CREATE TYPE "public"."pixelforge_comment_anchor" AS ENUM('general', 'section', 'finding');--> statement-breakpoint
CREATE TYPE "public"."pixelforge_comment_status" AS ENUM('open', 'resolved', 'dismissed', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."pixelforge_review_status" AS ENUM('in_review', 'changes_requested', 'approved', 'superseded', 'cancelled');--> statement-breakpoint
CREATE TABLE "pixelforge_review_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"anchor_type" "pixelforge_comment_anchor" NOT NULL,
	"node_id" text,
	"finding_id" uuid,
	"body" text NOT NULL,
	"blocking" boolean DEFAULT false NOT NULL,
	"status" "pixelforge_comment_status" DEFAULT 'open' NOT NULL,
	"author_id" uuid,
	"author_name" text NOT NULL,
	"resolved_by_id" uuid,
	"resolved_by_name" text,
	"resolved_at" timestamp with time zone,
	"resolution_reason" text,
	"resolution_evidence" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pixelforge_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"page_version_id" uuid NOT NULL,
	"qa_run_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"status" "pixelforge_review_status" DEFAULT 'in_review' NOT NULL,
	"verdict_snapshot" "pixelforge_qa_verdict" NOT NULL,
	"score_snapshot" integer NOT NULL,
	"tree_hash" text NOT NULL,
	"target_station" "pixelforge_station",
	"request_reason" text,
	"accepted_risks" jsonb,
	"approved_by_id" uuid,
	"approved_by_name" text,
	"approved_at" timestamp with time zone,
	"approval_reason" text,
	"opened_by_id" uuid,
	"opened_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "pixelforge_review_comments" ADD CONSTRAINT "pixelforge_review_comments_review_id_pixelforge_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."pixelforge_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_review_comments" ADD CONSTRAINT "pixelforge_review_comments_project_id_pixelforge_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."pixelforge_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_review_comments" ADD CONSTRAINT "pixelforge_review_comments_finding_id_pixelforge_qa_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."pixelforge_qa_findings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_review_comments" ADD CONSTRAINT "pixelforge_review_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_review_comments" ADD CONSTRAINT "pixelforge_review_comments_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_reviews" ADD CONSTRAINT "pixelforge_reviews_project_id_pixelforge_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."pixelforge_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_reviews" ADD CONSTRAINT "pixelforge_reviews_page_version_id_pixelforge_page_versions_id_fk" FOREIGN KEY ("page_version_id") REFERENCES "public"."pixelforge_page_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_reviews" ADD CONSTRAINT "pixelforge_reviews_qa_run_id_pixelforge_qa_runs_id_fk" FOREIGN KEY ("qa_run_id") REFERENCES "public"."pixelforge_qa_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_reviews" ADD CONSTRAINT "pixelforge_reviews_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_reviews" ADD CONSTRAINT "pixelforge_reviews_opened_by_id_users_id_fk" FOREIGN KEY ("opened_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pixelforge_review_comments_review_idx" ON "pixelforge_review_comments" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "pixelforge_review_comments_project_status_idx" ON "pixelforge_review_comments" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "pixelforge_review_comments_blocking_open_idx" ON "pixelforge_review_comments" USING btree ("project_id") WHERE "pixelforge_review_comments"."blocking" = true and "pixelforge_review_comments"."status" = 'open';--> statement-breakpoint
CREATE INDEX "pixelforge_reviews_project_idx" ON "pixelforge_reviews" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "pixelforge_reviews_page_version_idx" ON "pixelforge_reviews" USING btree ("page_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pixelforge_reviews_active_idx" ON "pixelforge_reviews" USING btree ("project_id") WHERE "pixelforge_reviews"."status" = 'in_review';--> statement-breakpoint
CREATE UNIQUE INDEX "pixelforge_reviews_project_round_idx" ON "pixelforge_reviews" USING btree ("project_id","round_number");