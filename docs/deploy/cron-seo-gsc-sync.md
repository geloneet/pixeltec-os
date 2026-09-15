# Registro de cron — `api/cron/seo-gsc-sync`

> **Estado (actualizado 2026-09-14, WO-2026-00345 L5) `[Documentado en NeuroPIXEL]`:** las
> credenciales de Search Console YA están cargadas en producción; el backfill de 16 meses
> terminó el 2026-08-31 (`hasMore: false`) y `/seo/contenido` mostró datos reales el
> 2026-09-04 (`01_CONTEXT/infraestructura.md`, `09_SEGUIMIENTO/Pixeltec.mx.md`). El cron
> diario de las 06:00 está registrado en el crontab del VPS. Las secciones «pendiente de
> Miguel» de abajo describen la configuración inicial y se conservan como referencia para
> un entorno nuevo; no son tareas abiertas. Lectura semanal de esos datos:
> `scripts/seo/gsc-weekly-report.ts` (`docs/seo/gsc-weekly/README.md`).

**Qué hace:** sincroniza los snapshots diarios de Google Search Console en `gsc_page_daily` y `gsc_query_daily`, y registra cada corrida en `seo_sync_runs`. Alimenta la pantalla `/seo/contenido` del módulo SEO & Contenido (WO-2026-00214). Independiente de los demás cron del repo: cada uno itera su propia fuente de datos.

**Auth:** mismo patrón que el resto de crons — `Authorization: Bearer $CRON_SECRET` (o `?secret=`), y la ruta llama `assertCronExecutionAllowed()` (contrato E0, `CRON_EXECUTION_MODE`). El secreto se valida ANTES del guard, para que una llamada sin credencial reciba 401 y no aprenda si el cron está activo.

## Modos — los decide el estado de la tabla, no un flag

| Situación | Qué hace |
|---|---|
| `gsc_page_daily` sin filas del sitio | **Backfill**: arranca 16 meses atrás (el máximo que Search Console conserva) |
| Historia incompleta hacia atrás | **Backfill**: sigue rellenando el hueco, de lo más reciente a lo más antiguo |
| Historia completa | **Incremental**: re-trae los últimos 5 días y hace *upsert* |

**Por qué se re-traen los últimos días y no sólo el más nuevo:** Search Console tiene 2-3 días de retraso y **reescribe** datos ya publicados durante unos días más. Un `INSERT` de una sola pasada dejaría congelados números que Google después corrigió.

**Por qué el backfill va por tandas:** 16 meses son ~490 días × 2 conjuntos de dimensiones × paginación. En una sola corrida sería una petición de decenas de minutos que cualquier timeout mata a la mitad, dejando huecos silenciosos. Cada corrida avanza como máximo `MAX_DAYS_PER_RUN` (45 días) y la siguiente continúa desde donde quedó — el plan se deduce de qué hay guardado, así que reanudar es automático y no necesita estado propio. Con una corrida diaria, el histórico completo tarda ~11 días en llenarse. Si Miguel quiere acelerarlo, basta con disparar la ruta a mano varias veces seguidas.

La respuesta trae `hasMore: true` mientras queden días de backfill pendientes.

## Configuración previa (hecha en producción; referencia para entornos nuevos)

El cron responde `{"success":true,"skipped":"gsc_not_configured"}` —200, no error— mientras falten estas variables. Un entorno donde Search Console todavía no está conectado no está roto; devolver 500 llenaría el log de falsas alarmas todos los días.

```bash
# .env.production
EGRESS_GOOGLE_MODE=live
GSC_SITE_URL=sc-domain:pixeltec.mx
GOOGLE_SERVICE_ACCOUNT_JSON=<base64 del JSON de la cuenta de servicio>
```

Generar el base64 (la clave privada lleva saltos de línea reales y pegarla cruda en un `.env` la parte en el primer `\n`):

```bash
base64 -i ruta/a/service-account.json | tr -d '\n'
```

La cuenta de servicio necesita permiso de **lectura** sobre la propiedad en Search Console: Configuración → Usuarios y permisos → añadir su `client_email`. Y hay que habilitar la Search Console API en el proyecto de Google Cloud.

## Crontab del VPS (registrado; se conserva el comando como referencia)

```bash
# crontab de `ubuntu`, mismo patrón que billing-charges / recurring-charges:
0 6 * * * curl -s -H "Authorization: Bearer $(grep CRON_SECRET /home/ubuntu/pixeltec-os/.env.production | cut -d= -f2)" \
  https://pixeltec.mx/api/cron/seo-gsc-sync >> /home/ubuntu/pixeltec-os-cron.log 2>&1
```

Diaria a las 06:00 (sugerido): los datos de Search Console no cambian dentro del día, así que más frecuencia sólo gastaría cuota. `CRON_SECRET` ya existe en `.env.production` (compartido con los demás crons, contrato E0 `CRON_EXECUTION_MODE=enabled`); no hace falta secreto nuevo.

## Requisito de base de datos

La migración `drizzle/0051_seo_contenido.sql` debe estar aplicada (lo está en producción: el backfill completo de 2026-08-31 la exige; ver `docs/deploy/migration-0051-seo-contenido.md` para el procedimiento). Sin ella el cron falla en la primera consulta.

## Verificación después del primer disparo

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://pixeltec.mx/api/cron/seo-gsc-sync | jq
# → {"success":true,"mode":"backfill","start":"…","end":"…","days":45,"rows":N,"hasMore":true}

docker exec -i pixeltec-os-db psql -U pixeltec_os -d pixeltec_os \
  -c "SELECT status, window_start, window_end, rows, error FROM seo_sync_runs ORDER BY started_at DESC LIMIT 5;"
```

Si `status='error'`, la columna `error` trae un código estable (`gsc_http_403`, `gsc_credentials_invalid`, `gsc_not_configured`) — **nunca** el cuerpo de la respuesta de Google, que incluiría el correo de la cuenta de servicio y la propiedad consultada.
