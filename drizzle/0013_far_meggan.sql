ALTER TYPE "public"."definition_event_type" ADD VALUE 'started' BEFORE 'sealed';--> statement-breakpoint
ALTER TYPE "public"."definition_status" ADD VALUE 'draft' BEFORE 'in_progress';