-- 0038 — Invariancia real en DB para `strategies` (revisión PR #98)
--
-- SQL plano ADITIVO, misma convención que 0029–0037 (drizzle/meta/ no se
-- toca a propósito). `createStrategy` hacía SELECT→INSERT para evitar
-- duplicados, que no es idempotencia real bajo concurrencia: dos requests
-- concurrentes pueden pasar el SELECT antes de que cualquiera haga el INSERT
-- y ambas terminan insertando. Estos dos índices mueven la invariancia a
-- donde sí se puede garantizar.
--
-- Dos índices porque NULL no es comparable consigo mismo en un unique
-- normal (dos filas con project_id NULL nunca chocan por su cuenta):
--
--   strategies_owner_client_project_uidx  → a lo sumo 1 fila por
--     (owner_id, client_id, project_id) cuando project_id NO es NULL.
--   strategies_owner_client_orphan_uidx   → a lo sumo 1 fila huérfana
--     (project_id IS NULL) por (owner_id, client_id) — índice PARCIAL.
--
-- IF NOT EXISTS: idempotente por si se reaplica.

CREATE UNIQUE INDEX IF NOT EXISTS "strategies_owner_client_project_uidx" ON "strategies" USING btree ("owner_id","client_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "strategies_owner_client_orphan_uidx" ON "strategies" USING btree ("owner_id","client_id") WHERE "strategies"."project_id" is null;
