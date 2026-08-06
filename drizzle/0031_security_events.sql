-- 0031 — Auditoría de seguridad `security_events` (C-PR2)
--
-- SQL plano ADITIVO. No toca drizzle/meta/ a propósito: el journal y el
-- snapshot se regeneran en el saneo del drift de migraciones. NO aplicar a
-- ninguna base desde esta rama; se aplica en el deploy gobernado.
--
-- Registro de eventos de seguridad de cuentas internas (tabla `users`):
-- login_success / login_failed / password_changed / password_reset_requested /
-- password_reset_completed. Escritor único: src/lib/security/events.ts
-- (fire-safe: un fallo aquí jamás bloquea login ni cambio de contraseña).

CREATE TABLE "security_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "actor_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "type" text NOT NULL,
  "ip" text,
  "user_agent" text,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "security_events_user_created_idx" ON "security_events" ("user_id", "created_at");
CREATE INDEX "security_events_type_created_idx" ON "security_events" ("type", "created_at");
