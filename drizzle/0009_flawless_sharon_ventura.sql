ALTER TABLE "leads" ADD COLUMN "wants_contact" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "wants_contact_at" timestamp with time zone;