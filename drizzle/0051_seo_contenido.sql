-- 0051 — SEO & Contenido: analítica de comportamiento, snapshots de Search
-- Console y atribución de leads (WO-2026-00214, Fase 1).
--
-- ADITIVA e IDEMPOTENTE. Crea CUATRO tablas nuevas y añade SIETE columnas a
-- `leads`; no modifica ninguna fila existente, ni columnas, ni índices previos.
-- No toca Finanzas, WhatsApp, PixelBot, Clientes ni Blog (`blog_posts` se
-- referencia como FK, no se altera).
--
-- Privacidad: `content_events` NO guarda IP cruda (solo `ip_hash`, el mismo
-- `hashIp()` salado que ya usan `leads` y `rate_limit`), no guarda query
-- strings y no guarda contenido de formularios. La cookie de atribución
-- (`pt_attr`) es first-party y su contenido se persiste en `leads.attribution`
-- sin datos personales.
--
-- Reversión:
--   ALTER TABLE leads DROP COLUMN IF EXISTS client_id;
--   ALTER TABLE leads DROP COLUMN IF EXISTS converted_at;
--   ALTER TABLE leads DROP COLUMN IF EXISTS qualified_at;
--   ALTER TABLE leads DROP COLUMN IF EXISTS service_interest;
--   ALTER TABLE leads DROP COLUMN IF EXISTS first_content_path;
--   ALTER TABLE leads DROP COLUMN IF EXISTS landing_path;
--   ALTER TABLE leads DROP COLUMN IF EXISTS attribution;
--   ALTER TABLE leads DROP COLUMN IF EXISTS session_id;
--   DROP TABLE IF EXISTS seo_sync_runs;
--   DROP TABLE IF EXISTS gsc_query_daily;
--   DROP TABLE IF EXISTS gsc_page_daily;
--   DROP TABLE IF EXISTS content_events;

-- ── Eventos de comportamiento first-party (sin PII) ─────────────────────────
CREATE TABLE IF NOT EXISTS "content_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "site_id" text DEFAULT 'pixeltec.mx' NOT NULL,
  "session_id" text NOT NULL,
  "path" text NOT NULL,
  "post_id" uuid,
  "event" text NOT NULL,
  "meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "ip_hash" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "content_events"
    ADD CONSTRAINT "content_events_post_id_blog_posts_id_fk"
    FOREIGN KEY ("post_id") REFERENCES "blog_posts"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "content_events_path_created_at_idx"
  ON "content_events" ("path", "created_at");
CREATE INDEX IF NOT EXISTS "content_events_event_created_at_idx"
  ON "content_events" ("event", "created_at");
CREATE INDEX IF NOT EXISTS "content_events_session_idx"
  ON "content_events" ("session_id");

-- Dedupe de HITOS: la garantía de que un scroll al 75 % no cuenta cinco veces
-- porque el visitante subió y bajó vive en la base, no en la promesa del
-- cliente. Parcial a propósito: solo cubre los eventos que representan un
-- hito único por sesión+path. Los eventos de servidor (`lead_created`,
-- `diagnostic_complete`, `newsletter_signup`) quedan fuera — pueden repetirse
-- legítimamente y no deben ser silenciados por un índice.
CREATE UNIQUE INDEX IF NOT EXISTS "content_events_milestone_idx"
  ON "content_events" ("session_id", "path", "event", (coalesce("meta"->>'depth', '')))
  WHERE "event" IN ('view', 'scroll', 'cta_click', 'diagnostic_start');

-- ── Snapshots diarios de Google Search Console ──────────────────────────────
-- Snapshots, no agregados: Search Console reescribe los últimos días, así que
-- se guarda el día crudo y el cron re-trae y hace upsert sin perder historia.
-- `ctr`/`position` como `real` porque es lo que devuelve la API: redondear al
-- guardar destruiría el dato original.
CREATE TABLE IF NOT EXISTS "gsc_page_daily" (
  "site_id" text NOT NULL,
  "date" date NOT NULL,
  "page" text NOT NULL,
  "clicks" integer DEFAULT 0 NOT NULL,
  "impressions" integer DEFAULT 0 NOT NULL,
  "ctr" real DEFAULT 0 NOT NULL,
  "position" real DEFAULT 0 NOT NULL,
  "fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "gsc_page_daily_pk" PRIMARY KEY ("site_id", "date", "page")
);

CREATE INDEX IF NOT EXISTS "gsc_page_daily_page_date_idx"
  ON "gsc_page_daily" ("page", "date");

CREATE TABLE IF NOT EXISTS "gsc_query_daily" (
  "site_id" text NOT NULL,
  "date" date NOT NULL,
  "page" text NOT NULL,
  "query" text NOT NULL,
  "clicks" integer DEFAULT 0 NOT NULL,
  "impressions" integer DEFAULT 0 NOT NULL,
  "ctr" real DEFAULT 0 NOT NULL,
  "position" real DEFAULT 0 NOT NULL,
  "fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "gsc_query_daily_pk" PRIMARY KEY ("site_id", "date", "page", "query")
);

CREATE INDEX IF NOT EXISTS "gsc_query_daily_page_date_idx"
  ON "gsc_query_daily" ("page", "date");

-- ── Bitácora de corridas de sincronización ─────────────────────────────────
-- Sin esto, un backfill de 16 meses que falla a la mitad es invisible.
-- `error` guarda un código estable, nunca el cuerpo de la respuesta de Google.
CREATE TABLE IF NOT EXISTS "seo_sync_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "site_id" text NOT NULL,
  "source" text NOT NULL,
  "window_start" date,
  "window_end" date,
  "status" text DEFAULT 'running' NOT NULL,
  "rows" integer DEFAULT 0 NOT NULL,
  "error" text,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "seo_sync_runs_site_started_idx"
  ON "seo_sync_runs" ("site_id", "started_at");

-- ── Atribución en `leads` ──────────────────────────────────────────────────
-- `revenue` NO se duplica aquí: el dinero ya tiene dueño (`sales`,
-- WO-2026-00106/ADR-0057) y copiarlo crearía dos verdades que se
-- desincronizan en el primer pago parcial. El ingreso atribuible a un
-- contenido se deriva por client_id → sales. Por el mismo motivo
-- `converted_at` se deriva de la primera venta del cliente vinculado y no se
-- escribe a mano desde la UI.
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "session_id" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "attribution" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "landing_path" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "first_content_path" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "service_interest" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "qualified_at" timestamp with time zone;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "converted_at" timestamp with time zone;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "client_id" uuid;

DO $$ BEGIN
  ALTER TABLE "leads"
    ADD CONSTRAINT "leads_client_id_clients_id_fk"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "leads_session_idx" ON "leads" ("session_id");
CREATE INDEX IF NOT EXISTS "leads_client_idx" ON "leads" ("client_id");
CREATE INDEX IF NOT EXISTS "leads_first_content_path_idx" ON "leads" ("first_content_path");
