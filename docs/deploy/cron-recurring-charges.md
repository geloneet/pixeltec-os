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
