-- 0033 — Verificación en dos pasos TOTP `user_mfa` + códigos de recuperación (C-PR4)
--
-- SQL plano ADITIVO. No toca drizzle/meta/ a propósito: el journal y el
-- snapshot se regeneran en el saneo del drift de migraciones. NO aplicar a
-- ninguna base desde esta rama; se aplica en el deploy gobernado.
--
-- `secret_enc` guarda el secreto TOTP cifrado con AES-256-GCM
-- (src/lib/mfa/crypto.ts, clave en MFA_ENCRYPTION_KEY) — nunca en claro.
-- `enabled_at` NULL = enrolamiento pendiente (QR mostrado, aún sin
-- confirmar). `last_used_step` implementa el anti-replay: un TOTP solo vale
-- para un time-step ESTRICTAMENTE mayor que el último aceptado.
-- Los códigos de recuperación se guardan como sha256 (jamás en claro) y se
-- queman con `used_at` al primer uso.
--
-- Break-glass (usuario bloqueado sin autenticador ni recovery codes):
--   DELETE FROM user_mfa WHERE user_id = '<uuid>';
-- por psql vía SSH (el CASCADE de user_mfa_recovery_codes es por FK a users,
-- así que límpialos también: DELETE FROM user_mfa_recovery_codes WHERE user_id = '<uuid>';)

CREATE TABLE "user_mfa" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "secret_enc" text NOT NULL,
  "enabled_at" timestamptz,
  "last_used_step" bigint,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "user_mfa_recovery_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "code_hash" text NOT NULL,
  "used_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "user_mfa_recovery_codes_user_idx" ON "user_mfa_recovery_codes" ("user_id");
