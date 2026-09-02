-- 0050 — Retira 21 tablas sin uso y sus 20 tipos enum (WO-2026-00186, lote 3)
--
-- DESTRUCTIVA e IRREVERSIBLE sin respaldo. Borra datos: no es aditiva, no es
-- idempotente en el sentido de recuperar nada. `IF EXISTS` + `CASCADE` solo la
-- hacen re-ejecutable, no reversible.
--
-- Qué hace: elimina las 21 tablas que ya no tiene ningún código del repo
-- (verificado con `grep -rnw <const> src` sobre `feature/limpieza-notificaciones`:
-- cero referencias fuera de `src/lib/db/schema.ts`, excepto una mención en un
-- comentario de `src/lib/blog/versions.ts`) y los 20 `pgEnum` que solo esas
-- tablas usaban. En el mismo commit desaparecen del esquema Drizzle: tras
-- aplicarla, código y base de datos vuelven a coincidir.
--
--   Portal legacy (Firestore):  client_portal_projects, portal_requests,
--                               portal_security_events
--   Growth (módulo retirado):   growth_jobs, growth_social_accounts
--   Legacy Firestore:           legacy_tasks
--   Definición de Proyecto:     project_definitions, definition_stations,
--                               definition_messages, definition_events
--   PixelForge (F1, nunca se    pixelforge_projects, pixelforge_context_sources,
--   construyó la UI):           pixelforge_artifacts, pixelforge_events,
--                               pixelforge_assets, pixelforge_ai_runs,
--                               pixelforge_visual_references,
--                               pixelforge_creative_directions,
--                               pixelforge_page_versions, pixelforge_qa_runs,
--                               pixelforge_qa_findings
--
-- NO se toca nada vivo: `clients`, `projects`, `tasks`, `finances`, `tickets`,
-- `growth_brands/posts/campaigns/credits/credit_ledger`, `client_portal_updates`,
-- WhatsApp, blog y facturación siguen intactos. Los enums compartidos con tablas
-- vivas se CONSERVAN a propósito: organization_plan, credit_transaction_type,
-- campaign_status, post_status, social_platform (los usan growth_credits,
-- growth_credit_ledger, growth_campaigns y growth_posts).
--
-- Orden: hijos → padres. El CASCADE está por si en prod existen vistas o FKs
-- que no estén declaradas en el esquema Drizzle; el orden hace que en el caso
-- normal no haga falta.
--
-- Plan de aplicación en prod (contenedor pixeltec-os-db 127.0.0.1:5437, user/db
-- pixeltec_os, mismo patrón de reconciliación que 0038–0049 en infraestructura.md):
--   0. RESPALDO PREVIO OBLIGATORIO — sin esto NO se aplica. Volcado de las 21
--      tablas (esquema + datos) antes de tocar nada:
--      docker exec pixeltec-os-db pg_dump -U pixeltec_os -d pixeltec_os \
--        -t client_portal_projects -t portal_requests -t portal_security_events \
--        -t growth_jobs -t growth_social_accounts -t legacy_tasks \
--        -t project_definitions -t definition_stations -t definition_messages \
--        -t definition_events -t pixelforge_projects -t pixelforge_context_sources \
--        -t pixelforge_artifacts -t pixelforge_events -t pixelforge_assets \
--        -t pixelforge_ai_runs -t pixelforge_visual_references \
--        -t pixelforge_creative_directions -t pixelforge_page_versions \
--        -t pixelforge_qa_runs -t pixelforge_qa_findings \
--        > ~/backups/drop-dead-tables-$(date -u +%Y%m%dT%H%M%SZ).sql
--      Verificar que el archivo pesa > 0 y contiene los 21 `CREATE TABLE`.
--   1. Aplicar (antes o después del deploy de la imagen nueva: el código nuevo
--      ya no menciona estas tablas, así que ambos órdenes son seguros):
--      docker exec -i pixeltec-os-db psql -U pixeltec_os -d pixeltec_os < drizzle/0050_drop_dead_tables_wo186.sql
--   2. Fila de control: INSERT en drizzle.__drizzle_migrations (hash = sha256 del
--      contenido crudo de este .sql — `shasum -a 256 drizzle/0050_drop_dead_tables_wo186.sql`,
--      created_at = epoch en ms del momento de aplicación). El journal NO se
--      toca: `drizzle/meta/_journal.json` termina en idx 43 (0043) mientras la
--      carpeta llega a 0049 — drift preexistente del repo, ajeno a este WO.
--   3. Verificar: SELECT count(*) FROM information_schema.tables
--        WHERE table_schema='public' AND table_name IN ( … las 21 … );  → 0
--      y que la app arranca y /clientes, /proyectos, /finanzas, /blog responden.
--
-- Rollback: NO hay rollback SQL. Se restaura del respaldo del paso 0:
--   docker exec -i pixeltec-os-db psql -U pixeltec_os -d pixeltec_os < ~/backups/drop-dead-tables-<ts>.sql
-- (los enums se recrean con el volcado porque pg_dump -t incluye los tipos que
-- usan las tablas volcadas; si alguno faltara, recrearlo a mano desde el
-- `schema.ts` del commit anterior a este) y desplegar la imagen anterior.

-- ── Tablas: hijos → padres ──────────────────────────────────────────────────

DROP TABLE IF EXISTS "portal_security_events" CASCADE;
DROP TABLE IF EXISTS "portal_requests" CASCADE;
DROP TABLE IF EXISTS "client_portal_projects" CASCADE;

DROP TABLE IF EXISTS "growth_jobs" CASCADE;
DROP TABLE IF EXISTS "growth_social_accounts" CASCADE;

DROP TABLE IF EXISTS "legacy_tasks" CASCADE;

DROP TABLE IF EXISTS "pixelforge_qa_findings" CASCADE;
DROP TABLE IF EXISTS "pixelforge_qa_runs" CASCADE;
DROP TABLE IF EXISTS "pixelforge_page_versions" CASCADE;
DROP TABLE IF EXISTS "pixelforge_creative_directions" CASCADE;
DROP TABLE IF EXISTS "pixelforge_visual_references" CASCADE;
DROP TABLE IF EXISTS "pixelforge_ai_runs" CASCADE;
DROP TABLE IF EXISTS "pixelforge_assets" CASCADE;
DROP TABLE IF EXISTS "pixelforge_events" CASCADE;
DROP TABLE IF EXISTS "pixelforge_artifacts" CASCADE;
DROP TABLE IF EXISTS "pixelforge_context_sources" CASCADE;
DROP TABLE IF EXISTS "pixelforge_projects" CASCADE;

DROP TABLE IF EXISTS "definition_events" CASCADE;
DROP TABLE IF EXISTS "definition_messages" CASCADE;
DROP TABLE IF EXISTS "definition_stations" CASCADE;
DROP TABLE IF EXISTS "project_definitions" CASCADE;

-- ── Enums que solo usaban esas tablas ───────────────────────────────────────

DROP TYPE IF EXISTS "social_account_status";

DROP TYPE IF EXISTS "definition_station";
DROP TYPE IF EXISTS "definition_status";
DROP TYPE IF EXISTS "definition_station_status";
DROP TYPE IF EXISTS "definition_message_role";
DROP TYPE IF EXISTS "definition_event_type";

DROP TYPE IF EXISTS "pixelforge_station";
DROP TYPE IF EXISTS "pixelforge_status";
DROP TYPE IF EXISTS "pixelforge_artifact_kind";
DROP TYPE IF EXISTS "pixelforge_artifact_status";
DROP TYPE IF EXISTS "pixelforge_source_type";
DROP TYPE IF EXISTS "pixelforge_asset_kind";
DROP TYPE IF EXISTS "pixelforge_run_status";
DROP TYPE IF EXISTS "pixelforge_reference_coverage";
DROP TYPE IF EXISTS "pixelforge_reference_kind";
DROP TYPE IF EXISTS "pixelforge_direction_status";
DROP TYPE IF EXISTS "pixelforge_qa_run_status";
DROP TYPE IF EXISTS "pixelforge_qa_verdict";
DROP TYPE IF EXISTS "pixelforge_qa_severity";
DROP TYPE IF EXISTS "pixelforge_qa_browser_status";
