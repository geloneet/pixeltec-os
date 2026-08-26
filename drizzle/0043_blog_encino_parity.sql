-- 0043 — Blog con paridad a Muebles Encino (WO-2026-00088, D-C Opción A aprobada por Miguel)
--
-- ADITIVA e IDEMPOTENTE (generada con drizzle-kit y endurecida con IF NOT EXISTS).
-- No toca filas existentes ni columnas previas; los posts legacy leen `faq = []`,
-- `scheduled_at/maps_embed/ai_params = NULL`. No afecta Finanzas/WhatsApp/PixelBot/
-- Clientes. El estado 'scheduled' NO exige migración (`status` es text).
--
-- Cambios:
--   · blog_posts: + faq jsonb NOT NULL DEFAULT '[]', + scheduled_at timestamptz,
--     + maps_embed text, + ai_params jsonb; índice (status, scheduled_at) para el
--     barrido de programados.
--   · blog_categories: catálogo estilo WordPress (name UNIQUE, slug, parent_id 1 nivel,
--     description, created_by → users). `blog_posts.category` sigue siendo texto.
--
-- Plan de aplicación (mismo patrón que 0042; contenedor pixeltec-os-db):
--   1. `docker exec -i pixeltec-os-db psql -U <user> -d pixeltec_os` ← este archivo.
--   2. Fila de control en drizzle.__drizzle_migrations (hash = sha256 del contenido
--      crudo de este .sql; created_at = `when` del journal para 0043).
--   3. Verificar: \d blog_posts (faq, scheduled_at, maps_embed, ai_params) y \d blog_categories.
--   Aplicada en DEV (127.0.0.1:5437) por el Worker el 2026-08-25; NUNCA en prod sin GO.
--
-- Rollback (documentado, NO ejecutar sin decisión):
--   DROP INDEX IF EXISTS blog_posts_status_scheduled_idx;
--   ALTER TABLE blog_posts DROP COLUMN IF EXISTS ai_params, DROP COLUMN IF EXISTS maps_embed,
--     DROP COLUMN IF EXISTS scheduled_at, DROP COLUMN IF EXISTS faq;
--   DROP TABLE IF EXISTS blog_categories;
--   (Antes: UPDATE blog_posts SET status='draft' WHERE status='scheduled'; el código
--   anterior no conoce 'scheduled' y esos posts quedarían invisibles pero intactos.)

CREATE TABLE IF NOT EXISTS "blog_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text DEFAULT '' NOT NULL,
	"parent_id" uuid,
	"description" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "faq" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "maps_embed" text;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "ai_params" jsonb;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'blog_categories_parent_id_blog_categories_id_fk') THEN
    ALTER TABLE "blog_categories" ADD CONSTRAINT "blog_categories_parent_id_blog_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."blog_categories"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'blog_categories_created_by_users_id_fk') THEN
    ALTER TABLE "blog_categories" ADD CONSTRAINT "blog_categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "blog_categories_name_idx" ON "blog_categories" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_posts_status_scheduled_idx" ON "blog_posts" USING btree ("status","scheduled_at");