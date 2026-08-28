-- 0049 — Campos simples para "Trabajo" (WO-2026-00132, renovación MVP del
-- dashboard). Aditiva e idempotente. No modifica ninguna fila existente.
--
-- Reversión:
--   ALTER TABLE projects DROP COLUMN IF EXISTS progress_percent;
--   ALTER TABLE projects DROP COLUMN IF EXISTS observaciones;
--   ALTER TABLE projects DROP COLUMN IF EXISTS recursos;

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "progress_percent" integer NOT NULL DEFAULT 0;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "observaciones" text NOT NULL DEFAULT '';
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "recursos" text NOT NULL DEFAULT '';

DO $$ BEGIN
  ALTER TABLE "projects" ADD CONSTRAINT "projects_progress_percent_range"
    CHECK ("progress_percent" >= 0 AND "progress_percent" <= 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
