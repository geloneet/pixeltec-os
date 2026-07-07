# Plan de Remediación de Seguridad — pixeltec-os (web + dashboard)

## Contexto

Miguel pidió una validación de **seguridad, CORS, bugs, vulnerabilidades y mejoras** tanto del sitio público de PixelTEC como del dashboard/CRM. Se auditó todo el proyecto Next.js 15 (App Router, Firebase Admin + client SDK, 59 rutas API, reglas Firestore, CSP/headers, nginx, historial de git) con 4 auditorías paralelas y verificación directa de cada hallazgo crítico.

**Arquitectura relevante para entender el riesgo:** el portal de clientes (`/[slug]`) usa el **SDK JS de cliente de Firebase sin autenticar** (`src/lib/firebase-server.ts`), no el Admin SDK. Por eso **las reglas de `firestore.rules` son la frontera de seguridad real** del portal — cualquiera en internet, con la config pública embebida en el bundle, puede ejecutar las mismas operaciones que el portal. El dashboard admin sí está detrás de `verifySessionCookie` (middleware) + `ADMIN_UIDS`.

El objetivo es cerrar las vulnerabilidades por orden de severidad, empezando por las que exponen datos/credenciales reales hoy.

---

## Hallazgos confirmados (con evidencia)

### 🔴 CRÍTICAS

**C1 — Secretos reales en el historial de git.**
`commit 70639bb` añadió `.env.production` con valores reales; `commit 42f09f6` solo lo borró del HEAD. Verificado: el historial aún contiene `RESEND_API_KEY` (36 chars) y **la clave privada completa del Firebase Admin service account** (`FIREBASE_ADMIN_PRIVATE_KEY`, 1732 chars). Con esa clave un atacante tiene acceso total a Firestore/Auth como admin, saltándose todas las reglas.
- Evidencia: `git show 70639bb:.env.production`.

**C2 — `clients` con `read: if true` en Firestore.**
`firestore.rules:15` expone públicamente TODO el documento de cada cliente del portal: `companyName`, `contactEmail`, `contactName`, `slug`, `status`, `services`, `taskProgress` y **el `accessCode` OTP en texto plano** (`src/app/actions.ts:583-585`). Un atacante lee el código directamente → **bypass total del login del portal** + fuga de PII de todos los clientes (enumerable). Las subcolecciones `updates` y `projects` (`firestore.rules:23,29`) también son públicas.

**C3 — `clients` con `allow update` sin auth.**
`firestore.rules:17-18` permite a cualquiera sobrescribir `accessCode`/`accessCodeExpiresAt`/`lastCodeRequestAt` de cualquier cliente. Un atacante fija un código conocido y toma control del portal de cualquier cliente.

**C4 — `POST /api/notifications/send` sin autenticación.**
`src/app/api/notifications/send/route.ts:4-13` entra directo a `req.json()` → `sendWhatsApp(message)`. Cualquiera dispara mensajes de WhatsApp al dueño (spam/phishing + gasto de Meta Cloud API). Mitigante parcial: destinatario fijo (`WHATSAPP_DEFAULT_TO`).

**C5 — `GET /api/auth/meta/callback` — account takeover OAuth.**
`src/app/api/auth/meta/callback/route.ts:34,75` persiste tokens de acceso FB/IG bajo `uid = state`, donde `state` solo se valida con un regex de formato (no es un nonce firmado ligado a sesión). Un atacante vincula SUS páginas a la cuenta de una víctima o inyecta tokens. Raíz: `src/app/api/auth/meta/route.ts:24` usa el uid en claro como `state`.

### 🟠 ALTAS

**A1 — CSP efectiva es débil (permite XSS).** Coexisten dos CSP y **gana la débil**: `next.config.ts:55-60` emite `Content-Security-Policy` (enforcing) con `'unsafe-inline'` **y** `'unsafe-eval'`; el middleware solo emite `Content-Security-Policy-Report-Only` con nonce/`strict-dynamic` (`src/middleware.ts:85`), que **no bloquea nada**. La CSP real no mitiga XSS.

**A2 — `POST /api/send-email` sin autenticación real.** `src/app/api/send-email/route.ts:21` solo comprueba que exista `RESEND_API_KEY` (comentario "Protected" es falsa seguridad). Envío de email a destinatario arbitrario sin rate-limit → spam desde el dominio, daño de reputación/deliverability.

**A3 — `/api/auth/meta` usa uid en claro como `state`** (raíz de C5). `src/app/api/auth/meta/route.ts:24`.

### 🟡 MEDIAS

**M1 — Patrón `Bearer undefined` fail-open en 5 crons.** Si `CRON_SECRET` falta en el entorno, `Bearer undefined` autentica: `cron/asistente/task-reminder:35`, `cron/asistente/weekly-rollover:9`, `growth/publish/scheduled:6`, `crypto-intel/alerts/evaluate:13`, `crypto-intel/prices/sync:15`. También `crypto-intel/telegram/webhook:37` (fail-open condicional). Ya existe el patrón fail-closed correcto en `notifications/alert`, `notifications/telegram/webhook`, `whatsapp/send-test`, `asistente/test-report` — unificar.

**M2 — `connect-src 'self' https: wss:` demasiado amplio** (`next.config.ts:65`): con XSS, canal libre de exfiltración. Restringir a dominios Firebase/Google concretos (como ya hace el middleware).

**M3 — IDOR inter-cliente en `documents/contract-pdf`.** `src/app/api/documents/contract-pdf/route.ts` con token de portal valida solo `contract.uid`, no `contract.clientId`. Un cliente de portal podría descargar contratos de otros clientes del mismo consultor adivinando `contractId`.

**M4 — `rehype-raw` sin `rehype-sanitize`** en el renderer de blog (`src/components/blog/markdown-renderer.tsx:7,150`). El markdown es generado por IA y admite HTML crudo → XSS almacenado.

**M5 — `POST /api/csp-report` sin límites.** `src/app/api/csp-report/route.ts:5-18` escribe en Firestore (`cspViolations`) sin rate-limit, cap de tamaño ni validación de esquema → inflado/contaminación de datos.

**M6 — Spam intra-tenant en `POST /api/portal/requests`.** Inserta task `[PORTAL]` prioridad "urgent" en `crm_data` sin rate-limit (`route.ts:40-59`); `title`/`description` sin escapar → posible stored XSS en el dashboard.

**M7 — `campaigns/strategy`: gasto de OpenAI antes del débito de créditos** (`src/lib/growth/actions/campaigns.ts:128` antes de `:156`) → requests concurrentes consumen API aunque la transacción de créditos aborte.

### 🟢 BAJAS / MEJORAS

- **B1 — Falta `Referrer-Policy` y `Permissions-Policy`** en los headers de Next (`next.config.ts:48-53`).
- **B2 — `NEXT_PUBLIC_TELEGRAM_BOT_TOKEN`** (`src/app/actions.ts:340-341`): prefijo público sobre un bot token; latente hoy (sin valor configurado) pero se filtraría al bundle si se define. Renombrar sin prefijo.
- **B3 — Secretos de cron en query string** (`notifications/daily|charges|test`): `?secret=` queda en logs de proxy. Migrar a header `Bearer`.
- **B4 — `/api/vps/health` solo `requireSession`** (no `requireAdmin`), inconsistente con el resto de `vps/*`.
- **B5 — HSTS inconsistente/duplicado y TLS** en nginx (`nginx.conf:43,105-110`): sin `preload` en nginx vs `preload` en app; vhost `pipastondoroque.com` sin `ssl_ciphers`/`Referrer-Policy`, usa `X-XSS-Protection` (deprecado), sin OCSP stapling.
- **B6 — Validación de entrada sin zod** en varias rutas POST (patrón bueno ya existe en `send-email/route.ts:14-41`).
- **B7 — `eslint.ignoreDuringBuilds: true`** (`next.config.ts:13`) puede ocultar errores reales.

---

## Bugs de correctitud (no-seguridad)

### 🔴 Pérdida de datos (crítico)
- **CRM sobreescrito sin transacción (patrón sistémico).** El cron de cobros hace read-modify-write de todo el doc `crm_data/{uid}` con `.set(data)` (`src/app/api/notifications/charges/route.ts:140`, verificado) usando datos leídos al inicio del loop; y el cliente hace lo mismo con `setDoc` (`src/components/crm/CRMContextCore.tsx:182`). Cron ↔ usuario ↔ pestañas compiten → **ediciones del CRM se destruyen silenciosamente**. Fix: persistir por sub-entidad o usar transacción/merge del campo puntual (`lastNotified`).

### 🟠 Altos
- **Sobrecobro de créditos Growth.** `src/lib/growth/ai/orchestrator.ts:61` cobra ANTES de generar; si `generateText` falla (`:67`) no hay refund. Igual con la imagen (`:89-98`): cobra `post_complete` pero si la imagen falla sigue text-only sin devolver el delta. Fix: cobrar tras éxito o refund en el catch. (Contraste: `campaigns.ts:156` sí lo hace transaccional y post-éxito — usar ese patrón.)
- **`revokePortalToken` siempre lanza 500.** `src/lib/portal/token.ts:61` escribe `portalToken: undefined`; ningún init del Admin SDK setea `ignoreUndefinedProperties` (verificado en `firebase-admin.ts`), así que `undefined` lanza "Cannot use undefined as a Firestore value". El DELETE de `/api/portal/token` nunca funciona y deja `crm_data` inconsistente. Fix: usar `null` u omitir la clave / `FieldValue.delete()`.
- **OTP del portal reporta éxito sin enviar.** `src/app/actions.ts:600`: `sendEmail(...).catch(console.error)` ignora el resultado (`sendEmail` retorna `{success:false}`, nunca rechaza) y la acción devuelve `success:true`. Se dice "código enviado" aunque no se envió, y el rate-limit bloquea el reintento 60s. Mismo dead-code try/catch en el email de cobros (`charges/route.ts:84-92`) → recordatorios de cobro nunca entregados ni reintentados. Fix: chequear `result.success`.
- **`checkRevoked=false` en mutaciones VPS.** `auth-guards.ts:18` → `vpsClient.ts:195` usa `verifySessionCookie(cookie, false)` mientras el middleware usa `true`. Tras "cerrar sesión en todos los dispositivos", una cookie robada sigue sirviendo para deploy/restart/pause hasta 14 días. Fix: `checkRevoked=true` en rutas mutantes.
- **Cobro "Vencido" inalcanzable.** `src/lib/crm/next-charge-date.ts:6` (`while (next <= now)`) siempre devuelve fecha futura → el badge "Vencido" nunca aparece; un cobro impago rueda al siguiente periodo. Fix: rastrear último periodo pagado/cobrado.
- **Semana ISO off-by-one.** `src/lib/assistant/week-helpers.ts:34` construye Jan 4 en UTC y lo pasa a MX → cuando Jan 4 es lunes (2027) cae en la semana anterior, desfasando todo /tareas y el rollover −7 días. Fix: construir Jan 4 como fecha wall MX.
- **Alertas crypto silenciosamente rotas.** `alert-engine.ts:79` actualiza `lastTriggeredAt` antes de entregar y el sender no lanza en fallo (cooldown consumido por envíos fallidos); MarkdownV2 sin escapar (`.`/`,`/`-`) → Telegram 400; fallback `chatId = rule.userId` (UID) → 400. La feature core queda no-op.

### 🟡 Medios
- **`amount` de cobros es string libre** (`src/types/crm.ts:100`), sin validar al crear (`CRMContextCore.tsx:418`): "1,500" o "$500" → `NaN`, que los totales coercionan a 0 → ingresos sub-reportados y "$NaN MXN" en emails.
- **Fechas de cobro con `new Date('YYYY-MM-DD')`** (UTC medianoche mostrada en MX → off-by-one) + `setMonth(+1)` que desborda fin de mes (`next-charge-date.ts:2,6`).
- **Balance negativo posible:** `orchestrator.ts:28` `balance as number` sin validar `undefined` → `undefined < amount` es `false`, no lanza "insuficiente", `increment(-amount)` deja saldo negativo.
- **CoinGecko `null`:** `price-engine.ts:82` escribe `current_price`/`market_cap` null sin default → `.toLocaleString()` crashea y `null < threshold` dispara falsos `price_below`.
- **Fugas de suscripción React:** `portal/page.tsx:175` (effect con `loading` en deps re-suscribe 3 `onSnapshot`); `WorkloadChart.tsx:30` (N+1 `getDocs`, snapshots fuera de orden, setState tras unmount, sin error callback → spinner infinito); `use-collection.tsx:46` / `use-doc.tsx` sin flag de cancelación.
- **`documentos/page.tsx:37`** `try/finally` sin `catch` → rechazo de Firestore se ve como "0 facturas / 0 contratos".
- **`portal/requests` falla abierto:** el gate `portalEnabled` solo corre `if (crmSnap.exists)` → doc faltante crea request igual; escribe todo `clients` no-transaccional; `type` sin validar.
- **`middleware.ts:122-124` fail-open** en error de infra de `verifySessionCookie` da acceso al *render* de páginas admin (las APIs sí fallan cerradas). Considerar fallar cerrado en `PROTECTED_PATHS`.

### 🟢 Bajos
- `alert-engine.ts:68` guarda el evento antes del `deliveredTo.push` → historial `deliveredTo: []` siempre.
- `auth-brute-force.ts:95` el contador de fallos nunca decae → lock por typos dispersos en meses; email conocido lockeable por terceros.
- Copy engañoso en contact/newsletter cuando el email de confirmación falla pero el lead sí persiste (`actions.ts:212`) — deliberado, solo el texto.

**Nota:** `npx tsc --noEmit` compila limpio, pero `skipLibCheck:true` + `eslint.ignoreDuringBuilds:true` hacen que el build no atrape lint ni bugs lógicos.

### ✅ Bien resueltos (no tocar)
`storage.rules` (deny-default + límite tamaño/tipo); `whatsapp/webhook` (HMAC SHA-256 + `timingSafeEqual`); `auth/session` (allowlist de Origin + rate-limit IP + lockout por email + `verifyIdToken` antes de mintear cookie — **CORS correcto, sin `*`**); toda la familia `vps/*` de mutación con `requireAdmin` + auditoría; colecciones sensibles (`leads`, `finances`, `invoices`, crypto, funnel) en `if false`; CRM con PII en `crm_data/{userId}` aislado por uid; sin `eval`/`exec`/SSRF/path-traversal; `dangerouslySetInnerHTML` en usos seguros.

---

## Plan de remediación (por fases)

### Fase 0 — Contención inmediata (C1) — antes que nada

**Por qué:** el commit `70639bb` dejó en el historial de git `RESEND_API_KEY` y la **clave privada completa del service account de Firebase Admin** (verificado: 1732 chars, PEM completo). Con esa clave, cualquiera que clone el repo obtiene control total de Firestore/Auth como admin, saltándose TODAS las reglas de seguridad. Borrarlo del HEAD (commit `42f09f6`) no basta: sigue recuperable con `git show 70639bb:.env.production`. Rotar es obligatorio **aunque** se purgue el historial, porque no se sabe quién ya lo clonó.

**Paso 1 — Rotar los secretos (hacer primero, la app sigue viva con las keys nuevas):**
- `RESEND_API_KEY`: dashboard de Resend → revocar la key `re_18p…` y generar una nueva. Actualizar `.env.production` (fuera de git) y el entorno del VPS.
- **Service account de Firebase Admin**: Firebase Console → Configuración del proyecto → Cuentas de servicio → "Generar nueva clave privada"; luego en Google Cloud Console → IAM → Cuentas de servicio → borrar/deshabilitar la clave antigua. Actualizar `FIREBASE_ADMIN_PRIVATE_KEY`/`FIREBASE_ADMIN_CLIENT_EMAIL` en el entorno.
- Por precaución (pudieron estar en versiones posteriores del archivo): revisar/rotar `CRON_SECRET`, `ANTHROPIC_API_KEY`, `PORTAL_SESSION_SECRET`, `PIXELBOT_INTERNAL_SECRET`, `WHATSAPP_ACCESS_TOKEN`/`APP_SECRET`, tokens de Meta y Telegram.

**Paso 2 — Purgar el historial (reescribe git, requiere force-push — coordinar con cualquier clon):**
```bash
# Backup primero
git clone --mirror . ../pixeltec-os-backup.git

# Opción A — git filter-repo (recomendado)
pip install git-filter-repo   # si no está
git filter-repo --path .env.production --invert-paths --force

# Opción B — BFG
# bfg --delete-files .env.production && git reflog expire --expire=now --all && git gc --prune=now --aggressive

# Reconectar el remote (filter-repo lo elimina) y forzar
git remote add origin <URL-del-remote>
git push origin --force --all
git push origin --force --tags
```
- **Después del force-push:** avisar a cualquier colaborador para que re-clone (no `git pull`, se corromperían). Verificar: `git log --all -- .env.production` vacío y `git show 70639bb:.env.production` falla.
- ⚠️ Acción irreversible sobre historia compartida. **Este runbook queda documentado para ejecución manual por Miguel — no se ejecuta desde el plan.**

### Fase 1 — Cerrar el portal (C2, C3)
Archivos: `firestore.rules`, `src/app/actions.ts`, `src/lib/firebase-server.ts`.
- Cambiar `clients` a `allow read: if request.auth != null` (o `if false`) y **eliminar el `allow update` público** (`firestore.rules:15-18`). Igual para subcolecciones `updates`/`projects` (`:23,29`).
- Migrar el flujo de portal (lookup de slug, lectura de dashboard, request/verify de accessCode) a **Server Actions con Admin SDK** en lugar del client SDK sin auth. Reutilizar `getAdminFirestore()` de `src/lib/firebase-admin.ts`. Las server actions de OTP en `actions.ts:526,632` ya corren server-side; falta que las lecturas del dashboard (`src/app/[slug]/dashboard/page.tsx`, `portal-entry-client.tsx`) dejen de leer Firestore directo desde el cliente.
- **Hashear el `accessCode`** antes de guardarlo (`actions.ts:583`) y comparar hash en `actions.ts:632`, para que ni siquiera un futuro leak de la colección lo exponga.

### Fase 2 — Endpoints sin auth (C4, C5, A2, A3)
- `notifications/send`: añadir `requireAdmin` o `CRON_SECRET` fail-closed (copiar patrón de `notifications/alert/route.ts`).
- `send-email`: añadir `requireSession`/`requireAdmin` + rate-limit; quitar el comentario engañoso.
- OAuth Meta (`auth/meta` + `callback`): generar `state` = nonce CSPRNG, guardarlo ligado a la sesión (Firestore/cookie firmada) y **validarlo en el callback** contra la sesión actual, no solo el regex de formato.

### Fase 3 — CSP y headers (A1, M2, M4, B1)
- Promover la CSP con nonce del middleware a **enforcing** (`Content-Security-Policy`) y **eliminar** la CSP estática con `unsafe-inline`/`unsafe-eval` de `next.config.ts`, o al menos quitar esos dos tokens. Validar que la app no rompa (Next inyecta el nonce). Restringir `connect-src` a dominios concretos.
- Añadir `rehype-sanitize` después de `rehype-raw` en `markdown-renderer.tsx`.
- Añadir `Referrer-Policy: strict-origin-when-cross-origin` y un `Permissions-Policy` restrictivo en `next.config.ts`.

### Fase 4 — Endurecimiento (M1, M3, M5, M6, M7, B2–B7)
- Unificar todos los crons al patrón fail-closed (`const expected = CRON_SECRET ? ... : null; if (!expected || auth !== expected) 401`).
- `contract-pdf`: validar también `contract.clientId === resolved.clientId` en el path de token de portal.
- `csp-report`: cap de tamaño de body + rate-limit + validar Content-Type.
- `portal/requests`: rate-limit por token (reutilizar `enforceRateLimit` de `src/lib/rate-limit.ts`) + escapar `title`/`description` + 403 si el doc no existe.
- Renombrar `NEXT_PUBLIC_TELEGRAM_BOT_TOKEN` → `TELEGRAM_BOT_TOKEN`; migrar secretos de cron de query a header Bearer; `vps/health` a `requireAdmin`; endurecer nginx (HSTS/ciphers/stapling); estandarizar validación con zod.

### Fase 5 — Bugs de correctitud
Prioridad por impacto (pérdida de datos / dinero primero):
1. **Escrituras no-transaccionales de `crm_data`** (`charges/route.ts:140`, `CRMContextCore.tsx:182`): migrar a transacción o merge del campo puntual. Es la causa raíz de pérdida de datos entre cron/usuario/pestañas.
2. **Créditos Growth:** cobrar tras éxito o refund en catch (`orchestrator.ts:61,89-98`); validar `balance` numérico (`:28`). Usar el patrón correcto de `campaigns.ts:156`.
3. **`revokePortalToken`** (`portal/token.ts:61`): `null`/omitir/`FieldValue.delete()` en vez de `undefined`.
4. **Chequear `result.success`** en los envíos de email OTP y cobros (`actions.ts:600`, `charges/route.ts:84-92`).
5. **`checkRevoked=true`** en mutaciones VPS (`vpsClient.ts:195`).
6. **Fechas/timezones:** `next-charge-date.ts` (parseo date-only local, `addMonths` de date-fns, badge "Vencido" alcanzable), `week-helpers.ts:34` (Jan 4 wall MX).
7. **Alertas crypto:** escapar MarkdownV2, que el sender lance en fallo, actualizar cooldown solo tras éxito, saltar precios `null` (`alert-engine.ts`, `price-engine.ts:82`).
8. **`amount` de cobros:** validar/parsear a número al crear (`CRMContextCore.tsx:418`).
9. **Fugas React:** flags de cancelación en `use-collection.tsx`/`use-doc.tsx`/`WorkloadChart.tsx`, quitar `loading` de deps en `portal/page.tsx:175`, `catch` en `documentos/page.tsx:37`.

---

## Verificación
- **Firestore rules:** `firebase emulators:start` + probar que una lectura anónima de `clients/{id}` ahora falla y que el portal (vía server action) sigue funcionando. Alternativamente `firebase deploy --only firestore:rules` en un proyecto de prueba.
- **Endpoints:** `curl` sin cookie/secret contra `notifications/send`, `send-email`, cada cron → debe devolver 401. Con credenciales válidas → 200.
- **CSP:** cargar el sitio con DevTools abierto, confirmar header `Content-Security-Policy` (no Report-Only) sin `unsafe-inline`/`unsafe-eval`, y que no hay errores de CSP que rompan hidratación de Next/Firebase Auth.
- **Git:** `git log --all -- .env.production` debe salir vacío tras el purge; `git show 70639bb:.env.production` debe fallar.
- **Regresión:** `npm run build` y `npx tsc --noEmit` limpios; login admin + flujo de portal + generación de un PDF probados manualmente.

## Alcance / decisiones
- **Este documento es solo el plan — no se ejecuta nada.** Miguel pidió únicamente el plan de ejecución.
- Alcance acordado: **plan completo (las 5 fases)**, de críticas a bajas incluyendo todos los bugs de correctitud.
- La **Fase 0** (rotación de secretos + reescritura del historial de git) queda documentada como runbook manual para que Miguel la ejecute cuando decida; son acciones irreversibles sobre producción/historia compartida.
- La migración del portal a Admin SDK (Fase 1) es la de mayor esfuerzo; el resto son cambios acotados.
