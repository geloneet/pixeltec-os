# Cómo se conectó Facebook/Instagram al Growth Suite (documentado antes de borrar)

**WO-2026-00132** — Miguel pidió documentar esta conexión (le interesa conservarla como referencia) antes de borrar el resto del Growth Suite/Marketing. No se implementa ni se reactiva ahora — solo queda el registro de cómo funcionaba, sin secretos.

## Qué es

Un flujo OAuth2 estándar de Meta (Facebook Login for Business) para que un usuario admin de PixelTEC OS conectara sus páginas de Facebook (y, si tenían una cuenta de Instagram profesional vinculada, esa también) al sistema — para que el Growth Suite pudiera publicar posts en su nombre.

**No es lo mismo que la integración de WhatsApp Business API** (`src/lib/whatsapp/**`, protegida y sin tocar) — son dos apps/flujos distintos que comparten el mismo proveedor (Meta) pero no comparten código, tokens ni tablas. **Messenger no tenía un scope propio implementado** en este flujo — solo `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`, `instagram_basic`, `instagram_content_publish` (posts + lectura de páginas + Instagram, no mensajería).

## Flujo (2 rutas)

1. **Inicio** — `GET /api/auth/meta` (`src/app/api/auth/meta/route.ts`, ya borrado):
   - Requiere sesión activa (`getSessionUserId()`).
   - Genera un nonce CSRF de un solo uso (32 bytes aleatorios), lo guarda en una cookie `httpOnly` con `path: /api/auth/meta` y 10 min de vida.
   - Redirige a `https://www.facebook.com/v21.0/dialog/oauth` con `client_id` (`META_APP_ID`), `redirect_uri`, los scopes de arriba y `state` = el nonce.
   - **Corrección de seguridad ya aplicada:** el `state` NUNCA lleva el uid en claro — antes sí, y permitía a un atacante vincular sus propias páginas a la cuenta de otra persona (account takeover). El uid del callback se deriva siempre de la sesión activa.

2. **Callback** — `GET /api/auth/meta/callback` (`src/app/api/auth/meta/callback/route.ts`, ya borrado):
   - Valida el `state` contra la cookie (`crypto.timingSafeEqual`), valida que haya sesión activa.
   - Intercambia el `code` por un token corto (`exchangeCodeForToken`), luego lo cambia por uno de larga duración (`getLongLivedToken`, default 60 días si Meta no manda `expires_in`).
   - Trae el usuario de Facebook (`getFacebookUser`) y sus páginas (`getFacebookPages`).
   - Por cada página: guarda una fila `platform: 'facebook'` en `growth_social_accounts` (owner = uid de sesión, `facebookPageId`, `facebookPageName`, `accessToken` de la página, `tokenExpiresAt`). Si la página tiene una cuenta de Instagram profesional vinculada (`page.instagram_business_account.id`), también guarda una fila `platform: 'instagram'`.
   - Errores de Meta (`?error=`) se limitan a una lista cerrada de códigos OAuth2 (RFC 6749) antes de reflejarse en la URL de redirect — nunca se refleja `error_description` (texto libre de un tercero, riesgo de XSS/log injection), solo se loguea en servidor.
   - Redirige a `/crecimiento/publisher?meta_connected=N` (ruta ya borrada) o `?meta_error=<código>`.

## Variables de entorno (solo nombres, sin valores)

- `META_APP_ID`, `META_APP_SECRET` — credenciales de la app de Meta usada para este OAuth (Facebook Login for Business). Viven en `.env.production`, no se tocan al borrar el código — si algún día se reactiva, el `.env` ya las tiene.
- `NEXT_PUBLIC_APP_URL` — base para construir `redirect_uri`.

## Tabla de datos (`growth_social_accounts`)

Guardaba las páginas/cuentas conectadas (owner, plataforma, IDs de FB/IG, token de acceso de la página, expiración). **No se borra la tabla en este WO** — solo el código que la alimentaba y la UI (`/crecimiento/**`). Si se reactiva el Growth Suite en el futuro, los datos y el flujo de conexión siguen siendo válidos (los tokens de página ya habrán expirado a los 60 días, habría que re-conectar).

## Checklist de reactivación (si algún día se retoma)

1. Restaurar `src/lib/growth/**`, `src/app/api/growth/**`, `src/app/api/auth/meta/**`, `src/app/(admin)/crecimiento/**` desde el historial de git (`feature/dashboard-mvp-reset`, commit previo a este borrado).
2. Confirmar que `META_APP_ID`/`META_APP_SECRET` siguen vigentes en Meta for Developers (revisar si la app pasó por su propio App Review si se piensa usar en producción con usuarios reales, igual que WhatsApp).
3. Volver a poner el módulo `marketing` (y sus hijos `contenido`/`campanas`/`calendario`/`publicaciones`/`brand-brain`) en `state: "active"` en `src/lib/modules/registry.ts`.
4. Cualquier cuenta conectada antes tendrá el token de página expirado (60 días) — hay que reconectar desde `/crecimiento/publisher` una vez reactivado.
