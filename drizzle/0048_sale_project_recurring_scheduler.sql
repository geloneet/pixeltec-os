-- 0048 — Proyecto y scheduler automáticos al aceptar/cobrar una cotización
-- (2026-08-27, ver docs/superpowers/specs/2026-08-27-cotizacion-aceptada-
-- proyecto-finanzas-design.md).
--
-- ADITIVA e IDEMPOTENTE. No modifica ninguna fila existente.
--
-- Reversión:
--   DROP INDEX IF EXISTS "billing_items_recurring_charge_due_idx";
--   ALTER TABLE billing_items DROP COLUMN IF EXISTS recurring_charge_id;
--   ALTER TABLE recurring_charges DROP COLUMN IF EXISTS reminder_cycle_due,
--     DROP COLUMN IF EXISTS reminder_checkpoints_sent;
--   DROP INDEX IF EXISTS "sales_project_idx";
--   ALTER TABLE sales DROP COLUMN IF EXISTS project_id;

-- ── 1. La Venta recuerda su Proyecto (guarda de idempotencia) ───────────────
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "project_id" uuid;
DO $$ BEGIN
  ALTER TABLE "sales" ADD CONSTRAINT "sales_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "sales_project_idx" ON "sales" ("project_id");

-- ── 2. Recurrentes: idempotencia de avisos por checkpoint ───────────────────
-- `last_notified` (un solo timestamp) no alcanza para saber cuáles de los
-- avisos 30/15/2/1 días antes ya se mandaron en el ciclo vigente.
ALTER TABLE "recurring_charges" ADD COLUMN IF NOT EXISTS "reminder_cycle_due" date;
ALTER TABLE "recurring_charges" ADD COLUMN IF NOT EXISTS "reminder_checkpoints_sent" jsonb DEFAULT '[]'::jsonb NOT NULL;

-- ── 3. Cobros materializados desde un recurrente vencido ────────────────────
ALTER TABLE "billing_items" ADD COLUMN IF NOT EXISTS "recurring_charge_id" uuid;
DO $$ BEGIN
  ALTER TABLE "billing_items" ADD CONSTRAINT "billing_items_recurring_charge_id_recurring_charges_id_fk"
    FOREIGN KEY ("recurring_charge_id") REFERENCES "recurring_charges"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Un recurrente no puede materializar dos veces el mismo período — el cron
-- puede correr dos veces el mismo día y el segundo INSERT debe no-opear, no
-- duplicar el cobro.
CREATE UNIQUE INDEX IF NOT EXISTS "billing_items_recurring_charge_due_idx"
  ON "billing_items" ("recurring_charge_id", "due_date")
  WHERE "recurring_charge_id" IS NOT NULL;
