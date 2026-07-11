CREATE TYPE "public"."definition_event_type" AS ENUM('created', 'sealed', 'reopened', 'invalidated', 'converted');--> statement-breakpoint
CREATE TYPE "public"."definition_message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."definition_station" AS ENUM('boceto', 'funciones', 'mvp', 'flujo');--> statement-breakpoint
CREATE TYPE "public"."definition_station_status" AS ENUM('pending', 'in_progress', 'sealed', 'invalidated');--> statement-breakpoint
CREATE TYPE "public"."definition_status" AS ENUM('in_progress', 'completed');--> statement-breakpoint
CREATE TABLE "definition_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"definition_id" uuid NOT NULL,
	"station" "definition_station",
	"type" "definition_event_type" NOT NULL,
	"actor_id" uuid,
	"actor_name" text NOT NULL,
	"reason" text,
	"snapshot" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "definition_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"definition_id" uuid NOT NULL,
	"station" "definition_station" NOT NULL,
	"role" "definition_message_role" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "definition_stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"definition_id" uuid NOT NULL,
	"station" "definition_station" NOT NULL,
	"status" "definition_station_status" DEFAULT 'pending' NOT NULL,
	"current_draft" text,
	"sealed_content" text,
	"sealed_at" timestamp with time zone,
	"sealed_by" uuid,
	"sealed_by_name" text,
	"reopen_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"client_crm_id" text NOT NULL,
	"title" text NOT NULL,
	"brain_dump" text NOT NULL,
	"current_station" "definition_station" DEFAULT 'boceto' NOT NULL,
	"status" "definition_status" DEFAULT 'in_progress' NOT NULL,
	"converted_project_crm_id" text,
	"converted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "definition_events" ADD CONSTRAINT "definition_events_definition_id_project_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."project_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "definition_events" ADD CONSTRAINT "definition_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "definition_messages" ADD CONSTRAINT "definition_messages_definition_id_project_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."project_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "definition_stations" ADD CONSTRAINT "definition_stations_definition_id_project_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."project_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "definition_stations" ADD CONSTRAINT "definition_stations_sealed_by_users_id_fk" FOREIGN KEY ("sealed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_definitions" ADD CONSTRAINT "project_definitions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_definitions" ADD CONSTRAINT "project_definitions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "definition_events_def_idx" ON "definition_events" USING btree ("definition_id","created_at");--> statement-breakpoint
CREATE INDEX "definition_messages_def_station_idx" ON "definition_messages" USING btree ("definition_id","station","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "definition_stations_def_station_idx" ON "definition_stations" USING btree ("definition_id","station");--> statement-breakpoint
CREATE INDEX "project_definitions_owner_idx" ON "project_definitions" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "project_definitions_client_idx" ON "project_definitions" USING btree ("client_id");