-- 0044 — Almacén de ajustes dinámicos del panel (WO-2026-00095, módulo SEO)
--
-- ADITIVA e IDEMPOTENTE. Crea UNA tabla nueva; no toca ninguna existente, ni
-- filas, ni columnas, ni índices previos. No afecta a Finanzas, WhatsApp,
-- PixelBot, Clientes ni Blog.
--
-- Por qué: el módulo SEO portado de Muebles Encino guarda el contenido y el
-- interruptor de publicación de cada herramienta (llms.txt, robots.txt,
-- local-business, structured-data, schema por página, redes) en un almacén
-- clave/valor. PixelTEC OS no tenía ninguno.
--
-- Alcance decidido por Miguel (2026-08-26): un solo sitio, pixeltec.mx. La
-- clave es texto libre, así que un futuro multi-sitio cabe por namespacing
-- (`site:<id>:<key>`) sin otra migración.
--
-- Reversión: DROP TABLE IF EXISTS "app_settings";  (no hay dependencias)

CREATE TABLE IF NOT EXISTS "app_settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value" text NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by" uuid,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "app_settings"
    ADD CONSTRAINT "app_settings_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "app_settings"
    ADD CONSTRAINT "app_settings_updated_by_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
