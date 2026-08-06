-- 0030 — Perfil y acceso (C-PR1)
--
-- SQL plano ADITIVO. No toca drizzle/meta/ a propósito: el journal y el
-- snapshot se regeneran en el saneo del drift de migraciones. NO aplicar a
-- ninguna base desde esta rama; se aplica en el deploy gobernado.
--
-- `users.bio` queda como columna muerta (la UI y updateProfile dejan de
-- escribirla); su DROP se difiere al Gate B8 junto con firebase_uid.

ALTER TABLE "users" ADD COLUMN "job_title" text;
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamptz;
ALTER TABLE "users" ADD COLUMN "last_login_ip" text;
