# TODO — Visualización de portalSecurityEvents

Pendiente: widget en panel admin que muestre eventos de seguridad de los
últimos 7/30 días, agrupados por type, con filtros por slug e IP.

Ubicación sugerida: nuevo módulo /admin/seguridad o tab dentro de /vps.

## KPIs sugeridos

- Total de `auth-slug-mismatch` en 7d (bandera roja si > 0)
- Total de `migration-slug-mismatch` en 7d (bandera roja si > 0)
- Total de `otp-rate-limit-ip` en 7d (indica abuse externo)
- IPs únicas con > 5 eventos en 24h (potential attacker)

## Índice Firestore requerido

Índice compuesto en `portalSecurityEvents`:
  - field: `type` ASC
  - field: `createdAt` DESC

Crear en Firebase Console antes de activar el widget.
Si no existe, Firestore lanza 400 con link directo para crearlo.

## Alertas Telegram (fase futura)

Una vez implementado el widget, considerar alertas al @pixeltec_infra_alerts_bot
cuando aparezcan eventos críticos (`auth-slug-mismatch`, `migration-slug-mismatch`).

## Notas de schema

Eventos creados antes de la v1 de `security-log.ts` usan campo `attemptedSlug`
en vez de `slug`. El widget debe leer ambos como fallback:
  `slug: event.slug ?? event.attemptedSlug ?? '—'`
