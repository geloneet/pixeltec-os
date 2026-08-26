-- 0045 — Cotizaciones simples (WO-2026-00101, orden de Miguel 2026-08-26)
--
-- ADITIVA e IDEMPOTENTE. Crea UNA tabla nueva; no toca ninguna existente, ni
-- filas, ni columnas, ni índices previos. No afecta a Finanzas, WhatsApp,
-- PixelBot, Blog, SEO ni a la máquina de propuestas (`proposals`, intacta).
--
-- Por qué tabla propia y no `proposals`: aquella arrastra definición previa,
-- generación con IA, versiones, contrato y aceptación del cliente, y depende de
-- módulos hoy ocultos. Una cotización es un documento plano que se crea a mano.
--
-- Importes: ENTEROS EN CENTAVOS dentro del jsonb `items`. Sin flotantes.
--
-- Reversión: DROP TABLE IF EXISTS "quotes";  (no hay dependencias)

CREATE TABLE IF NOT EXISTS "quotes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL,
  "folio" text NOT NULL,
  "title" text NOT NULL,
  "items" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "tax_enabled" boolean DEFAULT true NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "valid_until" timestamp with time zone,
  "status" text DEFAULT 'borrador' NOT NULL,
  "public_token" text NOT NULL,
  "sent_at" timestamp with time zone,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_id_clients_id_fk"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "quotes_client_idx" ON "quotes" ("client_id");
CREATE UNIQUE INDEX IF NOT EXISTS "quotes_folio_idx" ON "quotes" ("folio");
CREATE UNIQUE INDEX IF NOT EXISTS "quotes_public_token_idx" ON "quotes" ("public_token");
