CREATE TABLE "pixelforge_page_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"tree" jsonb NOT NULL,
	"notas" text NOT NULL,
	"warnings" jsonb NOT NULL,
	"created_by_id" uuid,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pixelforge_page_versions" ADD CONSTRAINT "pixelforge_page_versions_project_id_pixelforge_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."pixelforge_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixelforge_page_versions" ADD CONSTRAINT "pixelforge_page_versions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pixelforge_page_versions_project_idx" ON "pixelforge_page_versions" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pixelforge_page_versions_project_version_idx" ON "pixelforge_page_versions" USING btree ("project_id","version");