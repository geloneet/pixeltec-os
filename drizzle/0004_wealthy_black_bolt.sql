ALTER TABLE "clients" ADD COLUMN "legacy_password_hash" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "documents" jsonb DEFAULT '[]'::jsonb NOT NULL;