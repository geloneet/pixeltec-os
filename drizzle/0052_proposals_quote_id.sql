-- 0052 — WO-2026-00222: liga un `proposal` (brief de propuesta) a la
-- cotización que lo originó (botón "Crear brief con IA" en /cotizaciones).
--
-- ADITIVA. Una sola columna nullable + un índice único (NULLs libres, no
-- rompe filas existentes). No modifica ninguna fila, columna ni índice
-- previos. No toca Cotizaciones (`quotes`) más que como referencia FK.
-- APLICA CON psql (drift conocido de __drizzle_migrations, ver 0029/0034):
-- registrar su fila al aplicarla. NO toca drizzle/meta/.
--
-- Reversión:
--   DROP INDEX IF EXISTS proposals_quote_id_idx;
--   ALTER TABLE proposals DROP COLUMN IF EXISTS quote_id;

ALTER TABLE "proposals" ADD COLUMN "quote_id" uuid;
--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE UNIQUE INDEX "proposals_quote_id_idx" ON "proposals" USING btree ("quote_id");
