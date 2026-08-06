-- Historial editorial del blog (dictamen UX 2026-08-05, B-PR2).
-- ADITIVA. Se aplica con psql (drift conocido de __drizzle_migrations);
-- registrar su fila al aplicarla, como se hizo con la 0028.
-- NOTA de numeración: la 0028 vive en el PR #78 (client workspace); esta se
-- numera 0029 por orden real de aterrizaje. El journal/snapshot de drizzle se
-- regenera en el saneo del drift (pendiente #2 del issue #79).
CREATE TABLE "blog_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"actor_id" uuid,
	"actor_name" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blog_activity" ADD CONSTRAINT "blog_activity_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "blog_activity" ADD CONSTRAINT "blog_activity_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "blog_activity_post_created_idx" ON "blog_activity" USING btree ("post_id","created_at");
