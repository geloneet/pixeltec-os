CREATE TABLE "smilemore_qa_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"respondent_name" text NOT NULL,
	"respondent_role" text,
	"branch" text,
	"system_usage" text,
	"answers" jsonb NOT NULL,
	"user_agent" text,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "smilemore_qa_responses_created_at_idx" ON "smilemore_qa_responses" USING btree ("created_at");