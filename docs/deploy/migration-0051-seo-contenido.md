# Migración 0051 — SEO & Contenido (pendiente en cualquier base)

**Qué hace:** crea `content_events`, `gsc_page_daily`, `gsc_query_daily` y `seo_sync_runs`, y añade siete columnas de atribución a `leads` (`session_id`, `attribution`, `landing_path`, `first_content_path`, `service_interest`, `qualified_at`, `converted_at`, `client_id`). Aditiva e idempotente — `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` y constraints en bloques `DO $$ … EXCEPTION WHEN duplicate_object`. No modifica ninguna fila existente ni toca Finanzas, WhatsApp, PixelBot, Clientes ni Blog (`blog_posts` y `clients` se referencian como FK, no se alteran).

**Estado: NO APLICADA EN NINGUNA BASE.** WO-2026-00214 entrega el `.sql`, el espejo en `src/lib/db/schema.ts` y esta nota. Aplicarla es una decisión de Miguel con su propio gate — este WO no la ejecutó ni en local ni en remoto.

## Cómo aplicarla cuando haya GO

Mismo criterio que 0048 y 0044-0047: **a mano vía psql, no con `drizzle-kit migrate`**, por el drift conocido de `drizzle.__drizzle_migrations` en este repo (migraciones 44-50 aplicadas en producción sin entrada en `drizzle/meta/_journal.json` — documentado en `docs/deploy/cron-recurring-charges.md` y en `01_CONTEXT/infraestructura.md` de NeuroPIXEL).

```bash
# Producción (VPS, contenedor de Postgres):
docker exec -i pixeltec-os-db psql -U pixeltec_os -d pixeltec_os -v ON_ERROR_STOP=1 \
  < drizzle/0051_seo_contenido.sql
```

`-v ON_ERROR_STOP=1` es obligatorio: sin él psql sigue tras un error y deja la migración a medias sin que el exit code lo diga.

### Verificación después de aplicar

```bash
docker exec -i pixeltec-os-db psql -U pixeltec_os -d pixeltec_os -c "\d content_events"
docker exec -i pixeltec-os-db psql -U pixeltec_os -d pixeltec_os -c "\d gsc_page_daily"
docker exec -i pixeltec-os-db psql -U pixeltec_os -d pixeltec_os \
  -c "SELECT column_name FROM information_schema.columns WHERE table_name='leads' AND column_name IN ('session_id','attribution','landing_path','first_content_path','service_interest','qualified_at','converted_at','client_id') ORDER BY 1;"
```

Las ocho columnas deben aparecer. `content_events` debe traer los cuatro índices (`path/created_at`, `event/created_at`, `session_id` y el único **parcial** `content_events_milestone_idx`).

### Dependencia previa

`gen_random_uuid()` — ya en uso por el resto del schema (Postgres 16 lo trae en `pg_catalog`, no hace falta `pgcrypto`). Si una base más vieja lo rechazara, `CREATE EXTENSION IF NOT EXISTS pgcrypto;` antes de la migración.

## Reversión

Al final del encabezado del propio `.sql`, en orden inverso. Es una reversión limpia porque todo lo que la migración crea es nuevo: no hay backfill que deshacer ni columnas existentes modificadas.

## Nota sobre el índice único parcial

`content_events_milestone_idx` es la garantía real del dedupe de hitos (un scroll al 75 % no cuenta cinco veces). Es **parcial** — solo cubre `view`, `scroll`, `cta_click` y `diagnostic_start`. Consecuencia práctica, ya conocida por la experiencia de la 0048: un `onConflictDoNothing({ target: [...] })` de Drizzle **compila pero Postgres lo rechaza en runtime (42P10)** contra un índice parcial, porque no puede inferir el árbitro. La forma que funciona es `.onConflictDoNothing()` sin `target`. El endpoint `/api/events` ya lo hace así.

## Journal de drizzle-kit

Esta migración **no** se generó con `drizzle-kit generate` y no tiene entrada en `drizzle/meta/_journal.json`, igual que 0044-0050. No se fabricó un timestamp para no introducir drift nuevo con datos inventados. Sigue pendiente la tarea de higiene de regenerar/reconciliar el journal completo — no bloquea nada, el schema real es la verdad.
