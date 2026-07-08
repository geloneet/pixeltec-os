CREATE TYPE "public"."whatsapp_contact_classification" AS ENUM('cliente', 'prospecto', 'soporte', 'proveedor', 'spam', 'otro');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_contact_status" AS ENUM('nuevo', 'en_atencion', 'esperando_cliente', 'resuelto', 'archivado');--> statement-breakpoint
CREATE TABLE "whatsapp_contact_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_phone" text NOT NULL,
	"text" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_contacts" (
	"phone" text PRIMARY KEY NOT NULL,
	"name" text,
	"classification" "whatsapp_contact_classification",
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assigned_to" text,
	"origin" text,
	"status" "whatsapp_contact_status",
	"urgent" boolean DEFAULT false NOT NULL,
	"linked_client_id" text,
	"action_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "whatsapp_contact_notes" ADD CONSTRAINT "whatsapp_contact_notes_contact_phone_whatsapp_contacts_phone_fk" FOREIGN KEY ("contact_phone") REFERENCES "public"."whatsapp_contacts"("phone") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "whatsapp_contact_notes_phone_idx" ON "whatsapp_contact_notes" USING btree ("contact_phone");