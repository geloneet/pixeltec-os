CREATE TYPE "public"."client_crm_status" AS ENUM('prospecto', 'activo', 'pausado', 'cerrado');--> statement-breakpoint
CREATE TABLE "client_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"actor_name" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "crm_status" "client_crm_status" DEFAULT 'prospecto' NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "next_action" jsonb;--> statement-breakpoint
ALTER TABLE "discovery_sessions" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "strategies" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "client_activity" ADD CONSTRAINT "client_activity_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_activity" ADD CONSTRAINT "client_activity_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_activity_client_created_idx" ON "client_activity" USING btree ("client_id","created_at");--> statement-breakpoint
ALTER TABLE "discovery_sessions" ADD CONSTRAINT "discovery_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discovery_sessions_project_idx" ON "discovery_sessions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "strategies_project_idx" ON "strategies" USING btree ("project_id");--> statement-breakpoint
UPDATE "clients" SET "crm_status" = 'activo'
WHERE "source" = 'crm_blob' AND "id" IN (SELECT DISTINCT "client_id" FROM "projects");--> statement-breakpoint
WITH "single" AS (
  SELECT "client_id", (array_agg("id"))[1] AS "pid" FROM "projects" GROUP BY "client_id" HAVING count(*) = 1
)
UPDATE "discovery_sessions" ds SET "project_id" = s."pid" FROM "single" s WHERE ds."client_id" = s."client_id";--> statement-breakpoint
WITH "single" AS (
  SELECT "client_id", (array_agg("id"))[1] AS "pid" FROM "projects" GROUP BY "client_id" HAVING count(*) = 1
)
UPDATE "strategies" st SET "project_id" = s."pid" FROM "single" s WHERE st."client_id" = s."client_id";