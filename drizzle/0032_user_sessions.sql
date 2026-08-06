-- 0032 — Sesiones revocables `user_sessions` (C-PR3)
--
-- SQL plano ADITIVO. No toca drizzle/meta/ a propósito: el journal y el
-- snapshot se regeneran en el saneo del drift de migraciones. NO aplicar a
-- ninguna base desde esta rama; se aplica en el deploy gobernado.
--
-- Cada login acuña una fila (el `id` es el `sid` que viaja en el JWT). El
-- callback `jwt` revalida contra esta tabla con throttle de 60s: una fila
-- revocada mata la sesión en ≤60s sin cambiar la estrategia JWT. Escritor
-- único: src/lib/auth/sessions.ts (validación FAIL-OPEN documentada ahí:
-- un outage de esta tabla jamás desloguea a todo el mundo).

CREATE TABLE "user_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "ip" text,
  "user_agent" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "last_seen_at" timestamptz NOT NULL DEFAULT now(),
  "revoked_at" timestamptz
);

CREATE INDEX "user_sessions_user_idx" ON "user_sessions" ("user_id");
CREATE INDEX "user_sessions_user_revoked_idx" ON "user_sessions" ("user_id", "revoked_at");
