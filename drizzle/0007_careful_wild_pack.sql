ALTER TYPE "public"."lead_source" ADD VALUE 'diagnostic';--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "empresa" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "industry" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "company_size" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "problems" text[];--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "suggested_services" text[];--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "priority" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "score" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "answers" jsonb;