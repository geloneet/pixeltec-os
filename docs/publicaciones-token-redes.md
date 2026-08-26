# Publicaciones (Publisher) — flujo técnico del token de redes sociales

**Estado:** módulo **OCULTO, no eliminado** (WO-2026-00088 §9; registro central `src/lib/modules/registry.ts`, módulo `publicaciones`, estado `hidden`). Todo el código, las rutas, las tablas y las cuentas conectadas siguen existiendo; este documento conserva el flujo con el que se acreditó/obtuvo el token para poder reactivarlo sin reconstruirlo.

**Sin secretos:** este documento solo nombra variables de entorno, archivos, funciones y tablas. Nunca valores, tokens, app secrets, IDs de app/páginas ni credenciales. Los IDs de la app de Meta y de los activos viven exclusivamente en el entorno del VPS (`.env.production`, fuera de git) y en el Business Manager de PixelTEC.

`[Verificado en código]` sobre `feature/dashboard-cleanup-blog` @ base `f87d0e2` (2026-08-25). Los archivos citados están en la zona de **no intervención** de la orden (`src/app/api/auth/**`, `src/lib/growth/**`, `src/app/api/growth/**`): se documentan, no se modifican.

---

## 1. Propósito

Permitir que PixelTEC OS publique contenido (posts generados en Content Studio / Campañas / Calendario) directamente en **Facebook Pages** e **Instagram Business** desde la pantalla `/crecimiento/publisher`, y que un cron publique los posts programados.

## 2. Proveedores

- **Meta** (Facebook Login for Business → Graph API `v21.0`): Facebook Pages e Instagram Business Accounts vinculadas a esas páginas.
- No hay otros proveedores (LinkedIn, X, TikTok…) implementados.

## 3. App de Meta / plataforma

- Una app de Meta propia de PixelTEC (tipo Business) cuyo ID y secreto se inyectan por entorno: `META_APP_ID`, `META_APP_SECRET`.
- Producto usado: **Facebook Login** (diálogo OAuth `https://www.facebook.com/v21.0/dialog/oauth`).
- Versión de Graph fijada en código: `GRAPH_VERSION = 'v21.0'` (`src/lib/growth/social/meta-api.ts:3-4`).
- **Distinta** de la app/WABA que usa PixelBot para WhatsApp Cloud API (esa vive en PixelBot y usa `WHATSAPP_*`; no se comparten tokens).

## 4. Activos involucrados (por tipo, sin IDs)

| Activo | Cómo entra al sistema |
|---|---|
| Usuario de Facebook que autoriza | `getFacebookUser(token)` → `facebook_user_id` |
| Páginas de Facebook administradas por ese usuario | `getFacebookPages(userToken)` → `facebook_page_id`, `facebook_page_name`, **token de página** |
| Cuenta de Instagram Business vinculada a cada página | campo `instagram_business_account` de `/me/accounts` → `instagram_business_id`, `getInstagramUsername` → `instagram_username` |
| Business Manager / system user | **No se usa** un system user: el token es de **página**, derivado del login del usuario. El Business Manager solo interviene en la configuración de la app en Meta (fuera del código). |

## 5. Permisos / scopes solicitados

`src/app/api/auth/meta/route.ts:6-12` (`SCOPES`):

- `pages_manage_posts`
- `pages_read_engagement`
- `pages_show_list`
- `instagram_basic`
- `instagram_content_publish`

Estos scopes exigen **App Review** de Meta para usuarios ajenos a los roles de la app (admins/developers/testers). Mientras la app esté en modo desarrollo, solo cuentas con rol en la app pueden autorizar.

## 6. Flujo de autorización (OAuth 2.0 Authorization Code)

1. **Inicio** — el usuario (con sesión de PixelTEC OS) pulsa «Conectar» en `/crecimiento/publisher`: enlace `<a href="/api/auth/meta">` (navegación real, no `next/link`; `src/app/(admin)/crecimiento/publisher/page.tsx:42,94,110`).
2. **`GET /api/auth/meta`** (`src/app/api/auth/meta/route.ts`): exige sesión (`getSessionUserId()` → 401 si no hay); genera `state` = nonce CSPRNG de 32 bytes (`crypto.randomBytes`), lo guarda en cookie `meta_oauth_state` (`httpOnly`, `secure` en producción, `sameSite=lax`, `maxAge` 10 min, `path=/api/auth/meta`; constante `OAUTH_STATE_COOKIE` en `src/lib/growth/social/meta-oauth-state.ts`) y redirige al diálogo de Meta con `client_id`, `redirect_uri`, `scope`, `response_type=code`, `state`.
   - Nota de seguridad (auditoría 2026-08-06, hallazgo C5/A3 en `docs/security-remediation-plan.md`): antes el `state` transportaba el uid en claro y permitía account takeover; hoy el `state` es solo un nonce y la identidad sale de la sesión.
3. **Callback `GET /api/auth/meta/callback`** (`src/app/api/auth/meta/callback/route.ts`):
   - `uid = getSessionUserId()` (sesión de PixelTEC OS, **nunca** del `state`) → sin sesión: `?meta_error=no_session`.
   - Valida `state` contra la cookie con `crypto.timingSafeEqual` (`isValidCsrfState`) → fallo: `?meta_error=invalid_state`.
   - Códigos de error de Meta se mapean a un conjunto cerrado (RFC 6749 §4.1.2.1, `OAUTH_ERROR_CODES`); `error_description` solo se registra en servidor.
   - Intercambio: `exchangeCodeForToken(code, redirectUri)` → `getLongLivedToken(short)` → `getFacebookUser` → `getFacebookPages` (0 páginas ⇒ `?meta_error=no_pages`).
   - Por cada página: `upsertSocialAccount({ platform: 'facebook', … accessToken: page.access_token, tokenExpiresAt })` y, si tiene IG vinculado, otra fila `platform: 'instagram'` con `instagramBusinessId`/`instagramUsername`.
   - Éxito: redirect a `/crecimiento/publisher?meta_connected=<n>` y borra la cookie del nonce (un solo uso).
4. **Publicar** — botón `PublishButton` → `POST /api/growth/publish` `{ postId, accountId }` → `publishPostToAccount` (verifica que post y cuenta pertenezcan al owner de la sesión).
5. **Programados** — `POST /api/growth/publish/scheduled` con `Authorization: Bearer $CRON_SECRET` → `publishScheduledPosts()`.

## 7. URLs de callback / redirect (por nombre y ruta; sin dominio literal)

| Nombre | Ruta | Construcción |
|---|---|---|
| Redirect URI de OAuth (debe estar registrada en la app de Meta como «Valid OAuth Redirect URI») | `/api/auth/meta/callback` | `${NEXT_PUBLIC_APP_URL}/api/auth/meta/callback` (`auth/meta/route.ts:18-19`) |
| Retorno a la UI tras conectar | `/crecimiento/publisher` | `${NEXT_PUBLIC_APP_URL}/crecimiento/publisher` (`callback/route.ts:51`) con `?meta_connected=<n>` o `?meta_error=<code>` |
| Inicio del flujo | `/api/auth/meta` | ruta interna, requiere sesión |

Por ambiente cambia únicamente `NEXT_PUBLIC_APP_URL` (y por tanto la redirect URI registrada en Meta).

## 8. Endpoints internos

| Método y ruta | Guard | Función |
|---|---|---|
| `GET /api/auth/meta` | sesión (`getSessionUserId`) | inicia OAuth |
| `GET /api/auth/meta/callback` | sesión + `state` | intercambia código, guarda cuentas |
| `POST /api/growth/publish` | sesión | publica un post en una cuenta |
| `POST /api/growth/publish/scheduled` | `Bearer CRON_SECRET` + `assertCronExecutionAllowed()` | barrido de programados |
| Server actions `getSocialAccounts`, `upsertSocialAccount`, `disconnectSocialAccount` (`src/lib/growth/actions/social-accounts.ts`) | sesión + owner | lectura/alta/baja de cuentas; el DTO al cliente **omite** `accessToken` |

Todos los handlers de `/api/growth/**` usan sesión (`getSessionUserId`), no `requireAdmin`; el rol `reviewer` los tiene denegados por middleware (WO-2026-00051). Egress a Meta pasa siempre por `assertMetaEgressAllowed` (`src/lib/egress-guard.ts`), que hoy está en modo `disabled` en producción (ADR-0028: sin secretos = sin egress).

## 9. Archivos y funciones

- `src/app/api/auth/meta/route.ts` — inicio OAuth (`SCOPES`, nonce, cookie).
- `src/app/api/auth/meta/callback/route.ts` — callback (`isValidCsrfState`, `oauthErrorCode`, intercambio, upsert). Test: `callback/route.test.ts`.
- `src/lib/growth/social/meta-oauth-state.ts` — `OAUTH_STATE_COOKIE`.
- `src/lib/growth/social/meta-api.ts` — `metaFetch` (frontera única de egress, timeout 15 s, sin redirects, errores sin cuerpo), `exchangeCodeForToken`, `getLongLivedToken`, `getFacebookUser`, `getFacebookPages`, `getInstagramUsername`, `createInstagramMediaContainer`, `publishInstagramMedia`, `publishFacebookPost`, `debugToken`.
- `src/lib/growth/social/publish.ts` — `publishPostToAccount`, `publishRowToAccount`, `publishScheduledPosts`, `buildCaption`.
- `src/lib/growth/social/publish-errors.ts` — mensajes públicos saneados.
- `src/lib/growth/actions/social-accounts.ts` — CRUD de cuentas (DTO sin token).
- `src/lib/growth/pg.ts` — `resolveOwnerId`, `resolveSocialAccountRow`.
- `src/app/(admin)/crecimiento/publisher/page.tsx`, `src/components/growth/publisher/{ConnectedAccountCard,PublishButton}.tsx` — UI.
- `src/lib/egress-guard.ts` — política `EGRESS_META_*`.

## 10. Tablas / almacenamiento

`growth_social_accounts` (`src/lib/db/schema.ts` ~1358-1383; creada en `drizzle/0000_powerful_ultimates.sql`; enum `social_account_status` = `connected|expired|error`):

`id`, `firestore_id`, `owner_id` (FK `users.id`, cascade), `platform` (`facebook|instagram`), `status`, `facebook_user_id`, `facebook_page_id`, `facebook_page_name`, **`access_token` (texto plano)**, `token_expires_at`, `instagram_business_id`, `instagram_username`, `created_at`, `updated_at`. Índice por owner; unicidad lógica `(owner, facebook_page_id, platform)` en el upsert.

Los posts y su estado de publicación viven en `growth_posts` (`status`, `scheduledAt`, `publishedAt`, `publishedPlatforms` jsonb con `publishedId`/`publishedUrl`).

## 11. Variables de entorno (solo nombres)

- Meta/OAuth: `META_APP_ID`, `META_APP_SECRET`, `NEXT_PUBLIC_APP_URL`.
- Cron: `CRON_SECRET`.
- Política de egress (ADR-0028): `EGRESS_META_MODE`, `EGRESS_META_APP_ALLOWLIST`, `EGRESS_META_ACCOUNT_ALLOWLIST`, `EGRESS_META_PRODUCTION_APP_IDS`, `EGRESS_META_PRODUCTION_ACCOUNT_IDS`, `EGRESS_META_ALLOW_CREDENTIAL_READ`, `EGRESS_META_ALLOW_PUBLISH`, `EGRESS_ALLOW_LIVE_OUTSIDE_PRODUCTION`.
- Contrato completo y validador: `.env.example` y `npm run validate:egress`.

## 12. Ciclo de vida del token

| Etapa | Cómo |
|---|---|
| Creación | código de autorización → `exchangeCodeForToken` (token de usuario de corta duración). |
| Intercambio | `getLongLivedToken` (`grant_type=fb_exchange_token`) → token de usuario de larga duración (~60 días). |
| Token almacenado | el **token de página** devuelto por `/me/accounts` (hereda la larga duración del token de usuario). `token_expires_at` = ahora + `expires_in` (o 60 días si Meta no lo devuelve). |
| Duración | ~60 días (valor de Meta; no es configurable en código). |
| Renovación | **No hay renovación automática.** La UI (`ConnectedAccountCard`) calcula `daysUntilExpiry`, avisa a ≤7 días y marca «Token expirado» a ≤0; el remedio es volver a pulsar «Conectar» (nuevo OAuth), que hace upsert sobre la misma fila. |
| Validación | `debugToken()` existe pero **no tiene llamadores**; no se valida el token contra Meta salvo al usarlo. Los valores `expired`/`error` del enum no se escriben nunca. |
| Revocación | `disconnectSocialAccount` borra la fila (no revoca en Meta); revocar en Meta se hace desde la cuenta del usuario o eliminando la app. |

## 13. Manejo de errores

- OAuth: errores de Meta → códigos cerrados en la query (`no_pages`, `invalid_state`, `oauth_failed`, `meta_denied`, `missing_params`, `no_session`); la UI mapea a mensajes (`publisher/page.tsx:23-29`).
- Graph API: `metaError(operation, status)` descarta el cuerpo (podría contener tokens); timeouts y redes → `META_API_ERROR: <op>`; cualquier 3xx se rechaza.
- Publicación: fallo → `growth_posts.status='failed'` con mensaje fijo `PUBLISH_FAILED_MESSAGE`; el detalle solo en logs (`err.name`). `sanitizePublishErrors` limpia filas legacy al leer.
- Egress bloqueado por política ⇒ la llamada no se construye (el `buildRequest` con secretos no se evalúa).

## 14. Requisitos por ambiente

| Ambiente | Requisito |
|---|---|
| Desarrollo (`npm run dev`, :9002) | `NEXT_PUBLIC_APP_URL` local, app de Meta en modo desarrollo con el usuario como tester/admin, redirect URI local registrada (Meta exige HTTPS salvo `localhost`), `EGRESS_META_MODE=live` + `EGRESS_ALLOW_LIVE_OUTSIDE_PRODUCTION` explícito (ADR-0028: fuera de producción el egress live exige opt-in). |
| Demo/preproducción pixeltec.mx (ADR-0037) | credenciales `NON_PROMOTABLE`; hoy `EGRESS_META_MODE=disabled` (sin secretos cargados). |
| Producción definitiva | app de Meta con App Review aprobado para los 5 scopes, redirect URI de producción, `EGRESS_META_PRODUCTION_APP_IDS`/`ACCOUNT_IDS` con allowlist, cron externo llamando a `/api/growth/publish/scheduled` con `CRON_SECRET`. |

## 15. Riesgos

1. **`access_token` en texto plano** en Postgres (sin cifrado en reposo; el único cifrado del repo es para secretos TOTP). Mitigación actual: nunca sale al cliente (DTO), la RPC que lo exponía fue eliminada (auditoría 2026-08-06).
2. **Sin renovación automática** del token: la publicación programada falla en silencio (mensaje fijo) cuando expira.
3. Handlers de growth gateados por sesión, no por `requireAdmin`: cualquier `staff` puede conectar/publicar.
4. Dependencia de App Review de Meta para usar la app fuera de los roles de desarrollo.
5. `publishScheduledPosts` publica con la **primera** cuenta conectada del owner (no elige por plataforma).
6. Logs `console.log` en el callback con IDs/nombres de página (no tokens).

## 16. Checklist exacto para reactivar Publicaciones

1. En `src/lib/modules/registry.ts`, módulo `publicaciones`: `state: "hidden"` → `"active"` (si también se quiere el hub y el resto de Marketing: `marketing`, `contenido`, `campanas`, `calendario`, `brand-brain`).
2. Ejecutar `npm test -- src/lib/modules src/components/nav` — actualizar `registry.test.ts` (`EXPECTED_STATES`) y las expectativas de navegación visible en `nav-integrity.test.ts` con revisión explícita.
3. Verificar que `/crecimiento/publisher` vuelve a servirse (el `layout.tsx` del módulo deja de responder 404 al cambiar el estado; no hay que tocarlo).
4. Confirmar en el entorno: `META_APP_ID`, `META_APP_SECRET`, `NEXT_PUBLIC_APP_URL` (redirect URI registrada en Meta = `${NEXT_PUBLIC_APP_URL}/api/auth/meta/callback`), `EGRESS_META_MODE` y allowlists según ambiente; `npm run validate:egress`.
5. Si la app de Meta sigue sin App Review: usar una cuenta con rol en la app.
6. Smoke: iniciar sesión → `/crecimiento/publisher` → «Conectar» → autorizar → volver con `?meta_connected=<n>` → tarjeta con «Conectada» y fecha de expiración → publicar un post de prueba en Facebook (sin imagen) → `POST /api/growth/publish/scheduled` con `CRON_SECRET` responde `{published, failed}`.
7. Revisar el riesgo 1 (token en claro) antes de reactivar en producción definitiva: cifrado en reposo es un cambio pendiente (ADR nueva), no parte de esta reactivación.

## 17. Pruebas / comandos de validación

```
npm test -- src/app/api/auth/meta src/lib/growth        # callback CSRF/errores, egress y publish
npm run validate:egress                                  # contrato de variables EGRESS_*
npm test -- src/lib/routes src/middleware.test.ts        # reviewer sigue sin acceso a /api/growth y /crecimiento
```

Tests existentes: `src/app/api/auth/meta/callback/route.test.ts`, `src/lib/growth/social/meta-egress.test.ts`, `src/lib/growth/social/publish.test.ts`.

## 18. Fecha y evidencia técnica

- 2026-08-25 — inventario de solo lectura sobre `f87d0e2` (WO-2026-00088 FASE 7).
- Historial relevante (`git log -- src/app/api/auth/meta src/lib/growth/social`): `61d66c0` feat(growth): Sprint 5 — Publisher Meta (origen) · `c3948bd` Meta OAuth fix · `1700b78` auditoría y remediación (portal, OAuth, CSP) · `26855d2` bloquea egress de Meta por defecto · `17f9b42` endurece redirects · `52575a7`/`7219859` sanea errores · `ce8cd2e` (#98) remediaciones funcionales.
- Documento previo que describe el hallazgo del `state`: `docs/security-remediation-plan.md` (C5, A3, L145).
- `git diff f87d0e2..HEAD -- src/app/api/auth src/lib/growth src/app/api/growth` = vacío (zona no intervenida).
