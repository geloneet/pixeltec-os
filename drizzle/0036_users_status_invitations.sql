-- 0036 — Estado de cuenta en `users` + invitaciones `user_invitations` (C-PR5)
--
-- NUMERACIÓN: 0034/0035 están reservadas por el lane Blog (otra rama); la
-- numeración final se fija al aterrizar ambos lanes en el saneo del drift.
--
-- SQL plano ADITIVO. No toca drizzle/meta/ a propósito: el journal y el
-- snapshot se regeneran en el saneo del drift de migraciones. NO aplicar a
-- ninguna base desde esta rama; se aplica en el deploy gobernado.
--
-- `status`: ciclo de vida de la cuenta interna — 'invited' desde que un admin
-- invita hasta que la persona fija su contraseña; 'suspended' bloquea el
-- login (authorize() rechaza status != 'active') y, como suspender revoca
-- todas las sesiones, expulsa las activas en ≤60s vía la validación
-- throttleada del sid (C-PR3). DEFAULT 'active' deja intactas las cuentas
-- existentes.
--
-- `user_invitations`: mismo principio que password_reset_tokens — solo el
-- sha256 del token toca la base; un leak de esta tabla no permite aceptar
-- ninguna invitación. `created_by` con SET NULL para no destruir el rastro
-- si se borra al admin que invitó.

CREATE TYPE "user_status" AS ENUM ('active', 'invited', 'suspended');

ALTER TABLE "users" ADD COLUMN "status" "user_status" NOT NULL DEFAULT 'active';

CREATE TABLE "user_invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "used_at" timestamptz,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "user_invitations_user_idx" ON "user_invitations" ("user_id");
CREATE UNIQUE INDEX "user_invitations_token_hash_idx" ON "user_invitations" ("token_hash");
