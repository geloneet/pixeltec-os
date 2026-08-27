-- 0046 — Cotizaciones MVP comercial (WO-2026-00104, reporte de Miguel 2026-08-26)
--
-- ADITIVA e IDEMPOTENTE. Solo añade columnas a `quotes` con DEFAULT: ninguna
-- fila existente pierde datos y las cotizaciones creadas con 0045 se siguen
-- abriendo (§28: extender, no reemplazar). No toca ninguna otra tabla —
-- Finanzas, WhatsApp, PixelBot, Blog y SEO intactos.
--
-- `status` sigue siendo text: los estados nuevos (aceptada, rechazada) no
-- exigen migración. «vencida» NO se guarda: se deriva de valid_until al leer,
-- para que una cotización no quede marcada vencida por no haberla abierto.
--
-- Importes: siguen en CENTAVOS enteros dentro del jsonb `items`.
--
-- Reversión: ALTER TABLE quotes DROP COLUMN IF EXISTS <cada una>;

ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'MXN' NOT NULL;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "problem" text DEFAULT '' NOT NULL;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "solution" text DEFAULT '' NOT NULL;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "scope_included" text DEFAULT '' NOT NULL;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "exclusions" text DEFAULT '' NOT NULL;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "estimated_delivery" text DEFAULT '' NOT NULL;
-- Forma de pago: {"type":"50_50"|"40_30_30"|"mensual"|"personalizada","custom":"…"}
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "payment_terms" jsonb DEFAULT '{"type":"50_50","custom":""}'::jsonb NOT NULL;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "accepted_at" timestamp with time zone;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "rejected_at" timestamp with time zone;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "next_follow_up_at" timestamp with time zone;
-- Motivo del rechazo: {"reason":"precio"|…,"comment":"…"}
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "rejection" jsonb;

CREATE INDEX IF NOT EXISTS "quotes_status_idx" ON "quotes" ("status");
CREATE INDEX IF NOT EXISTS "quotes_follow_up_idx" ON "quotes" ("next_follow_up_at");
