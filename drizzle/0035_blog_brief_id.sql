-- Vínculo REAL brief → artículo (B-PR7, plan aprobado 2026-08-05): hasta hoy
-- el único vínculo era data.generatedDraftId serializado en el jsonb del brief
-- (string con uuid PG o firestoreId legacy). Se materializa como FK nullable.
-- ADITIVA. NO aplicar automáticamente: se aplica con psql (drift conocido de
-- __drizzle_migrations); registrar su fila al aplicarla, como la 0029/0034.
-- El journal/snapshot de drizzle/meta se regenera en el saneo del drift
-- (pendiente #2 del issue #79) — esta migración NO toca drizzle/meta/.
ALTER TABLE "blog_posts" ADD COLUMN "brief_id" uuid;
--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_brief_id_blog_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."blog_briefs"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "blog_posts_brief_id_idx" ON "blog_posts" USING btree ("brief_id");
--> statement-breakpoint
-- Backfill (mismo .sql, corre al aplicar la migración): puebla brief_id desde
-- el vínculo serializado legacy — data.generatedDraftId apunta al uuid PG del
-- post o a su firestore_id según la época del brief.
UPDATE blog_posts p SET brief_id = b.id FROM blog_briefs b WHERE b.data->>'generatedDraftId' IS NOT NULL AND (b.data->>'generatedDraftId' = p.id::text OR b.data->>'generatedDraftId' = p.firestore_id);
