# Registro de cron — `api/cron/recurring-charges` (pendiente en VPS)

**Qué hace:** materializa en `billing_items` los recurrentes nacidos de una Venta (`sale_id` no nulo) cuando vence su primer período, y envía avisos de checkpoint (30/15 días antes para anuales, 2/1 día antes para mensuales) una vez materializados. Independiente de `notifications/charges` (CRM legado) y `notifications/billing-charges` (ADR-0040, C6) — ninguno reemplaza a otro, cada uno itera su propia fuente de datos.

**Auth:** mismo patrón que los cron existentes de este repo — `Authorization: Bearer $CRON_SECRET` (o `?secret=`), la ruta llama `assertCronExecutionAllowed()` (contrato E0, `CRON_EXECUTION_MODE`).

**Pendiente en el VPS (no ejecutado por este WO — deploy/infra, gate aparte):**

```bash
# crontab de `ubuntu`, mismo patrón que billing-charges / smile-more:
0 * * * * curl -s -H "Authorization: Bearer $(grep CRON_SECRET /home/ubuntu/pixeltec-os/.env.production | cut -d= -f2)" \
  https://pixeltec.mx/api/cron/recurring-charges >> /home/ubuntu/pixeltec-os-cron.log 2>&1
```

Frecuencia horaria (`0 * * * *`) sugerida por consistencia con `notifications/billing-charges` — Miguel decide si prefiere otra cadencia. `CRON_SECRET` ya existe en `.env.production` (compartido con los demás crons de este repo, contrato E0 `CRON_EXECUTION_MODE=enabled`); no hace falta secreto nuevo.

## Migración 0048 en producción

Aditiva e idempotente (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, constraint exception-guarded) — ver `drizzle/0048_sale_project_recurring_scheduler.sql`. Dado el drift conocido de `drizzle.__drizzle_migrations` en este repo (migraciones 31-48 con tablas ya aplicadas pero tracking desactualizado, mismo patrón que la reconciliación 2026-08-11 documentada en `01_CONTEXT/infraestructura.md`), aplicar **a mano vía psql** en el deploy, no vía `drizzle-kit migrate`:

```bash
docker exec -i pixeltec-os-db psql -U pixeltec_os -d pixeltec_os < drizzle/0048_sale_project_recurring_scheduler.sql
```

Verificado en dev: ya aplicada, columnas `sales.project_id` / `recurring_charges.reminder_cycle_due` / `billing_items.recurring_charge_id` existentes. Reversión documentada en el encabezado del propio `.sql`.

## Aplicado a producción 2026-08-28 (Claude Code, GO de Miguel)

Producción estaba en `drizzle.__drizzle_migrations` id=42 (2026-08-25) y **no tenía las tablas `app_settings`/`quotes`/`sales`** — todo el flujo cotización→proyecto→finanzas era nuevo ahí. Aplicadas en orden vía `docker exec -i pixeltec-os-db psql ... -v ON_ERROR_STOP=1 < drizzle/00NN_*.sql` desde el .sql del repo (no `drizzle-kit migrate`, mismo criterio que el resto de este repo por el drift conocido):

- `0043_blog_encino_parity` — OK, reconciliada en `__drizzle_migrations` (id=43, hash sha256 del .sql, `created_at` = `when` del journal — sí tenía entrada).
- `0044_app_settings`, `0045_quotes`, `0046_quotes_mvp`, `0047_sales_flow` — aplicadas OK (todas idempotentes, `CREATE TABLE IF NOT EXISTS` / `DO $$ ... EXCEPTION WHEN duplicate_object`). **Sin reconciliar en `__drizzle_migrations`**: `drizzle/meta/_journal.json` no tiene entradas para 44-48 (drift más profundo que el ya documentado — no fue solo el tracking DB, el journal local tampoco se generó con `drizzle-kit generate`). No se fabricó un timestamp para no introducir un drift nuevo con datos inventados. **Pendiente real:** regenerar/reconciliar el journal completo (tarea de higiene de repo aparte, no bloquea el deploy — el schema real ya está correcto y verificado, solo la tabla de bookkeeping de drizzle-kit queda desalineada).
- `0048_sale_project_recurring_scheduler` — aplicada OK (primer intento falló parcialmente por `sales` inexistente hasta aplicar 0047; reintentada tras 0047, columnas `sales.project_id` / `recurring_charges.reminder_cycle_due` / `billing_items.recurring_charge_id` verificadas en prod).
