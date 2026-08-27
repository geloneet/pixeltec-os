-- 0047 — Flujo post-aceptación: Venta, cobros y recurrentes (WO-2026-00106)
--
-- Autorizada por ADR-0057 (excepción controlada al congelamiento de Finanzas
-- del criterio 7 de WO-2026-00088). El congelamiento sigue vigente fuera de
-- este flujo.
--
-- ADITIVA e IDEMPOTENTE. Lo único que MODIFICA de una tabla existente es
-- `recurring_charges.project_id`, que pasa de NOT NULL a admitir NULL —
-- relajar una restricción nunca invalida una fila que ya existía.
--
-- Importes: `sales` NO guarda dinero. La deuda vive en `billing_items` y el
-- dinero recibido en `payment_records`. Una sola fuente de verdad.
--
-- Reversión:
--   DROP TABLE IF EXISTS "sales" CASCADE;
--   ALTER TABLE billing_items DROP COLUMN IF EXISTS sale_id;
--   ALTER TABLE recurring_charges DROP COLUMN IF EXISTS sale_id, DROP COLUMN IF EXISTS status;
--   (project_id volvería a NOT NULL solo si ninguna fila lo tiene en NULL)

-- ── 1. Venta ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "sales" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "folio" text NOT NULL,
  "client_id" uuid NOT NULL,
  "quotation_id" uuid NOT NULL,
  -- pendiente_anticipo | activa | completada | cancelada
  "status" text DEFAULT 'pendiente_anticipo' NOT NULL,
  "currency" text DEFAULT 'MXN' NOT NULL,
  -- Snapshot de lo aceptado: lo mínimo para que la Venta no dependa de que
  -- alguien edite después la cotización. NO se duplica la cotización entera.
  "title" text NOT NULL,
  "accepted_at" timestamp with time zone NOT NULL,
  "accepted_via" text DEFAULT 'otro' NOT NULL,
  "acceptance_note" text DEFAULT '' NOT NULL,
  "one_time_total_cents" integer DEFAULT 0 NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "sales" ADD CONSTRAINT "sales_client_id_clients_id_fk"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sales" ADD CONSTRAINT "sales_quotation_id_quotes_id_fk"
    FOREIGN KEY ("quotation_id") REFERENCES "quotes"("id") ON DELETE restrict;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LA garantía de idempotencia (§4): una cotización, como máximo una venta.
-- Es un índice único en la base, no una comprobación en la interfaz: dos
-- peticiones concurrentes no pueden crear dos ventas ni aunque se solapen.
CREATE UNIQUE INDEX IF NOT EXISTS "sales_quotation_idx" ON "sales" ("quotation_id");
CREATE UNIQUE INDEX IF NOT EXISTS "sales_folio_idx" ON "sales" ("folio");
CREATE INDEX IF NOT EXISTS "sales_client_idx" ON "sales" ("client_id");

-- ── 2. Los cobros conocen su Venta ──────────────────────────────────────────
-- `proposal_id` se conserva: explica el origen comercial anterior. `sale_id`
-- representa la obligación ya aceptada. No se rompe ninguna relación actual.
ALTER TABLE "billing_items" ADD COLUMN IF NOT EXISTS "sale_id" uuid;
DO $$ BEGIN
  ALTER TABLE "billing_items" ADD CONSTRAINT "billing_items_sale_id_sales_id_fk"
    FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "billing_items_sale_idx" ON "billing_items" ("sale_id");

-- Idempotencia de los cobros derivados (§4): una Venta no puede generar dos
-- veces el mismo concepto. Parcial: no afecta a los cobros sin venta.
CREATE UNIQUE INDEX IF NOT EXISTS "billing_items_sale_concept_idx"
  ON "billing_items" ("sale_id", "concept") WHERE "sale_id" IS NOT NULL;

-- ── 3. Recurrentes: se venden antes de que exista el proyecto ───────────────
ALTER TABLE "recurring_charges" ALTER COLUMN "project_id" DROP NOT NULL;
ALTER TABLE "recurring_charges" ADD COLUMN IF NOT EXISTS "sale_id" uuid;
ALTER TABLE "recurring_charges" ADD COLUMN IF NOT EXISTS "client_id" uuid;
-- pending_start | active | paused | cancelled
ALTER TABLE "recurring_charges" ADD COLUMN IF NOT EXISTS "status" text;

DO $$ BEGIN
  ALTER TABLE "recurring_charges" ADD CONSTRAINT "recurring_charges_sale_id_sales_id_fk"
    FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Migración del booleano al estado, compatible con lo que ya existe:
--   active = true  → 'active'
--   active = false → 'paused'  (estado CONSERVADOR: no se sabe si fue pausa o
--                    cancelación, y «pausado» preserva el comportamiento
--                    actual —no cobra— sin declarar una cancelación que nadie
--                    decidió. Documentado en ADR-0057.)
UPDATE "recurring_charges"
   SET "status" = CASE WHEN "active" THEN 'active' ELSE 'paused' END
 WHERE "status" IS NULL;

ALTER TABLE "recurring_charges" ALTER COLUMN "status" SET DEFAULT 'pending_start';
ALTER TABLE "recurring_charges" ALTER COLUMN "status" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "recurring_charges_sale_idx" ON "recurring_charges" ("sale_id");
CREATE INDEX IF NOT EXISTS "recurring_charges_status_idx" ON "recurring_charges" ("status");

-- `active` NO se elimina en esta migración: hay código de Finanzas congelado
-- que aún lo lee. Queda como campo derivado (`status = 'active'`) y su
-- eliminación se hará cuando ese código pueda tocarse. Declarado en ADR-0057.

-- `start_date` era NOT NULL, pero un recurrente en `pending_start` todavía NO
-- tiene fecha de inicio: la decide una persona al activarlo (§10 de la orden).
-- Inventar una fecha aquí sería exactamente lo que se pidió no hacer.
ALTER TABLE "recurring_charges" ALTER COLUMN "start_date" DROP NOT NULL;
-- `client_email` se deja como estaba (NOT NULL): relajarlo rompía el tipo
-- `CRMClient` en `crm-sync`, que está fuera del alcance de ADR-0057. Los
-- recurrentes nuevos lo rellenan desde `clients.email`.

DO $$ BEGIN
  ALTER TABLE "recurring_charges" ADD CONSTRAINT "recurring_charges_client_id_clients_id_fk"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
