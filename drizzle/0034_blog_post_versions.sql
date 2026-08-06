-- Versionado de artículos del blog (B-PR6, plan aprobado 2026-08-05):
-- snapshot inmutable del contenido en los momentos de riesgo (regeneración IA,
-- publicación, nueva revisión, restauración). Patrón de pixelforge_page_versions.
-- ADITIVA. NO aplicar automáticamente: se aplica con psql (drift conocido de
-- __drizzle_migrations); registrar su fila al aplicarla, como la 0029.
-- El journal/snapshot de drizzle/meta se regenera en el saneo del drift
-- (pendiente #2 del issue #79) — esta migración NO toca drizzle/meta/.
CREATE TABLE "blog_post_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"reason" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text NOT NULL,
	"body" text NOT NULL,
	"slug" text NOT NULL,
	"category" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"cover_image" text,
	"seo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"editorial" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"internal_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_id" uuid,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blog_post_versions" ADD CONSTRAINT "blog_post_versions_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "blog_post_versions" ADD CONSTRAINT "blog_post_versions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "blog_post_versions_post_idx" ON "blog_post_versions" USING btree ("post_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "blog_post_versions_post_version_idx" ON "blog_post_versions" USING btree ("post_id","version");
