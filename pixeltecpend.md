# PixelTEC OS — Sesiones de Continuación

---

## Sesión 5 — Portal de Clientes v2: borrado de los 3 sistemas viejos + portal nuevo desde cero (2026-07-10)

**Estado al cerrar:** trabajo en worktree `.claude/worktrees/portal-clientes-v2` (rama `worktree-portal-clientes-v2`), NO mergeado a `main`, sin deploy a producción (pendiente de que Miguel lo pida explícitamente).

### Qué se hizo

1. **Borrado de los 3 sistemas de portal viejos** (OTP por correo en `/[slug]`, contraseña en `/portal`, link público por token en `/portal/[token]`) — causaban confusión real: Miguel entró a un link esperando el flujo por correo y aterrizó en la vista pública por token. Commit `ba4405b` en `main`. Base de datos preservada intacta (sin migraciones de borrado).
2. **Spec y plan nuevos** (`docs/superpowers/specs/2026-07-09-portal-clientes-design.md`, `docs/superpowers/plans/2026-07-09-portal-clientes.md`) vía brainstorming + writing-plans, con varias rondas de preguntas — decisiones clave:
   - Ruta única `/portal` (correo + código OTP de 6 dígitos), sin slug ni token.
   - Solo 1 columna nueva en la BD: `clients.portalAccessEnabled`. Todo lo demás reusa columnas/tablas existentes (`accessCodeHash`, `projects`, `contracts`, `finances`, `tickets`, `clientPortalUpdates`).
   - **Corrección de arquitectura descubierta durante la planeación**: `/clientes` y `/clientes/[id]` (`useCRM()`) solo muestran clientes `source='crm_blob'` — 3 de 13 clientes reales. El control del portal (activar acceso, publicar actualizaciones) se construyó en un panel separado `/portal-admin`, con su propia capa de datos (`src/lib/client-portal/pg.ts`), sin tocar `useCRM()`/`crm-sync.ts`, para alcanzar a los 13 clientes reales.
3. **Implementación con Subagent-Driven Development** — 16 tareas, un subagente implementador + un revisor por tarea, en worktree aislado. 3 hallazgos Important corregidos durante revisión (non-null assertion en vez de narrowing correcto en `portal-login-client.tsx`; `formatCurrency` duplicado en vez de reusar `src/lib/utils.ts`; y un `.eslintrc.json` sin `"root": true` que rompía `npm run lint` dentro de cualquier worktree — bug de infraestructura, no del feature).
4. **Bug crítico encontrado en verificación end-to-end real (Task 16)** — ninguna revisión de código lo detectó porque requiere ejecutar el runtime exacto: `src/app/portal/page.tsx` llamaba a `clearPortalSessionCookie()` directo en el render de un Server Component, lo cual Next.js 15 prohíbe (solo Server Actions/Route Handlers pueden mutar cookies). Con una cookie válida de un cliente cuyo portal se desactiva, el usuario veía un 500 en vez del login. Reproducido en vivo contra un dev server real, corregido (se quita la llamada — la seguridad no depende de limpiar la cookie, ya que `getPortalDashboardData`/`isPortalAccessEnabled` revalidan `portalAccessEnabled` en cada uso), y re-verificado en vivo 3 veces.

### Validado esta sesión (contra un dev server real en el worktree, con datos de prueba creados y borrados en la misma sesión — nunca tocó clientes reales)

- `tsc --noEmit`: 0 errores. `npm run lint`: sin errores nuevos (los preexistentes son de archivos no relacionados). `vitest`: 38/38 tests pasan.
- Ciclo OTP completo contra la BD real: generar código, hash HMAC, verificar correcto/incorrecto, expiración, uso único (se limpia tras verificar).
- Correo duplicado entre dos clientes → rechazo determinístico (no autentica al azar).
- `portalAccessEnabled=false` → `getPortalDashboardData` retorna `null`; con `true` → dashboard real con proyectos/facturas/contratos/tickets/feed.
- `listAllClientsForPortalAdmin` confirmado en vivo: devuelve los 13 clientes reales (incluye `source='portal'` Y `'crm_blob'`), no solo los 3 que ve `/clientes` — la propiedad arquitectónica central del panel admin.
- HTTP real contra `/portal`: sin cookie → login (200); con cookie válida y portal activo → dashboard (200); con cookie válida y portal desactivado → login, no error (200, tras el fix del bug crítico).
- Descarga de contrato (`/api/portal/contract-pdf`): contrato propio firmado → 200 + PDF válido; contrato de OTRO cliente → 403; contrato propio sin firmar (borrador) → 403; sin sesión → 401.
- `/portal-admin` sin sesión → redirige a `/login` (307).
- Publicar actualización desde la capa de datos → aparece en el dashboard del cliente.

### Pendientes vivos — QA manual con clic real (requiere sesión de admin real de Miguel, no se probó con cuenta temporal/vía curl a propósito)

No se usó browser ni la sesión real de Miguel en esta sesión (sin herramienta de navegador disponible; todo se verificó por HTTP directo con cookies forjadas usando el secreto real, y por la capa de datos). Pendiente para la próxima sesión conjunta:

1. **Flujo completo por navegador**: entrar a `/portal`, pedir código, confirmar que llega el correo real (Resend), escribirlo, ver el dashboard — el envío de email nunca se verificó contra una bandeja real, solo que la función `sendEmail` se llama correctamente.
2. **Panel `/portal-admin` por clic real**: activar/desactivar el interruptor de un cliente real y publicar una actualización desde la UI (la lógica subyacente ya se verificó directo contra la BD, pero no el formulario/composer en el navegador).
3. **Botón "Cerrar sesión"** del dashboard — el `onClick` no se probó literalmente (se infirió su efecto quitando la cookie manualmente y confirmando que `/portal` vuelve a mostrar el login).
4. Confirmar en un build de producción (`next build && next start`) que el nombre del cliente ya no aparece en el payload RSC de depuración cuando el portal está desactivado — comportamiento visto solo en dev mode, no es un bug de este código, orthogonal al fix, pero vale la pena confirmar antes de deploy.

### Para reanudar en nueva sesión

```
Continuamos en PixelTEC OS. Terminé el Portal de Clientes v2 completo (16 tareas,
Subagent-Driven Development) en el worktree .claude/worktrees/portal-clientes-v2,
rama worktree-portal-clientes-v2 — NO mergeado a main todavía. Corregí un bug
crítico real (cookie mutation ilegal en Server Component) encontrado en la
verificación end-to-end contra un dev server real, no solo en revisión de código.
Quedan 4 items de QA manual con clic real (navegador + sesión de Miguel):
1. Flujo completo /portal por navegador con email real de Resend
2. Panel /portal-admin por clic real (toggle + publicar actualización)
3. Botón "Cerrar sesión" (solo se infirió el efecto, no se clickeó)
4. Confirmar en build de producción que no hay leak de datos en el payload RSC dev
El detalle completo está en pixeltecpend.md, sección "Sesión 5". Falta decidir
si mergear esta rama a main y cuándo — sin deploy a producción hasta que lo pidas.
```

---

## Sesión 4 — Diagnóstico Inteligente, portal unificado + hotfix de seguridad (2026-07-09)

**Estado al cerrar:** main pusheado a origin (`3d1024a`), dev server arriba, sin deploy a producción (por decisión de Miguel — pendiente de confirmación explícita).

### Qué se hizo

1. **Diagnóstico Inteligente** — wizard público de 6 pasos en `/diagnostico` (+ modal en home), scoring determinista (`src/lib/diagnostic/logic.ts`), persiste lead enriquecido y notifica al equipo por email + WhatsApp. Botón "Quiero que me contacten".
2. **Login** — "Olvidaste tu contraseña" (modo dev/staff) ahora envía correo real con token de un solo uso (`password_reset_tokens`). Texto "Somos // \<palabra rotativa\>" en el panel izquierdo.
3. **Portal de clientes unificado** — password portal (`source='portal'`) y token portal (`source='crm_blob'`) se gestionan desde el mismo tab "Portal" en `/clientes/[id]`, ramificado según el `source` del cliente.
4. **Fix de hidratación** — ofuscación de email de Cloudflare (`ObfuscatedMailto` en home, sección de newsletter).
5. **Code review (`/code-review` alto esfuerzo, 8 finder angles + verify)** encontró 8 bugs reales, todos corregidos como hotfix en el mismo commit:
   - Login del portal legado ahora filtra estrictamente `source='portal'` (antes cualquier cliente `crm_blob` podía entrar) + rechazo determinístico si hay email duplicado (columna sin unique constraint) en vez de autenticar contra una fila al azar.
   - Restaurado el control completo del portal por token (generar/rotar/revocar) que se había perdido al reescribir `PortalTab.tsx`.
   - Reiniciar una contraseña ya NO reactiva un portal desactivado a propósito (antes lo hacía en silencio).
   - Recreada la vista general de estado de portales en `/portal-legado` (se había perdido, sin reemplazo).
   - `DiagnosticWizard`: si el submit falla server-side, ya no se muestra una pantalla de "éxito" falsa — se queda en el formulario con el error visible + link de WhatsApp de respaldo.
   - `requestDiagnosticContactAction`: el WhatsApp ya no bloquea la respuesta (contradecía su propio comentario de "best-effort").
   - `StepResult`: `catch` explícito en vez de `try/finally` sin catch (evitaba una promesa rechazada sin capturar y mostraba "enviado" incluso si fallaba el transporte).

### Validado esta sesión

- TypeScript: 0 errores (`node_modules/.bin/tsc --noEmit`, binario real — `npx tsc` cae en el paquete placeholder de npm en este entorno, no usarlo para verificar).
- Diagnóstico exitoso y fallido (honeypot) probados end-to-end con Playwright — ya no hay pantalla de éxito falsa.
- Login de portal probado con clientes de prueba temporales (creados y borrados en la misma sesión, nunca tocó datos ni cuenta de Miguel):
  - `source='portal'` con contraseña correcta y activo → entra a `/portal` correctamente.
  - `source='crm_blob'` con hash+enabled seteados a mano (simulando dato legado) → login rechazado.
  - Dos clientes `source='portal'` con el mismo correo → login rechazado con mensaje de ambigüedad, no autenticación al azar.
- "No reactivación silenciosa" verificado por lectura de código: no queda ninguna llamada a `/toggle` dentro de `handleSavePassword`.

### Pendientes vivos — QA manual (requiere sesión de admin real de Miguel)

No se creó cuenta admin temporal ni se usó la sesión de Miguel para estas pruebas (bloqueado intencionalmente — requiere su usuario real). Pendiente para la próxima sesión conjunta:

1. **Rotar token** de un portal existente (`/clientes/[id]` → tab Portal, cliente `source='crm_blob'`) — confirmar que el link viejo deja de funcionar y el nuevo sí.
2. **Revocar token** — confirmar que el link deja de ser accesible (`/portal/[token]` → 404 o rechazo) y que el estado se refleja en la UI.
3. **Desactivar portal + resetear contraseña** en un cliente `source='portal'` real desde la UI de `/clientes/[id]` — confirmar en vivo (clic real, no solo lectura de código) que el portal sigue inactivo después del reset hasta activarlo explícitamente con el interruptor.

### Para reanudar en nueva sesión

```
Continuamos en PixelTEC OS. Cerramos una sesión de hotfix de seguridad sobre el
portal de clientes + Diagnóstico Inteligente (HEAD: 3d1024a, tsc clean, pusheado
a origin/main). Quedan 3 items de QA manual pendientes que necesitan mi sesión de
admin real (no se probaron con cuenta temporal a propósito):
1. Rotar token de portal existente
2. Revocar token de portal existente
3. Desactivar portal + resetear contraseña de un cliente source='portal' desde
   la UI de /clientes/[id], confirmando que NO se reactiva solo
El detalle completo está en pixeltecpend.md, sección "Sesión 4".
```

---

## Sesión 3 — Sincronización de estado y limpieza (2026-07-02)

**Estado al cerrar:** main pusheado a origin (`d469136`), dev server arriba, sin deploy (por decisión de Miguel).

### Qué se hizo

1. **Push a origin/main** — 20 commits que estaban solo en local (task cards redesign completo + proposals feature). origin/main pasó de `aede639` a `d469136`.
2. **Dev server levantado** — `npm run dev` (puerto 9002), `https://dev.pixeltec.mx` responde 200 vía nginx.
3. **Verificación de rutas** — `/documentos`, `/ia-factory` y `/crecimiento/analytics` responden 307 → `/login` (middleware OK, no hay 404). Verificación completa con sesión pendiente de que el login en dev funcione.
4. **Growth Analytics — NO es pendiente accionable.** El blueprint (`docs/superpowers/plans/2026-06-23-content-studio-blueprint.md` §"❌ Analytics") lo difiere deliberadamente a **Fase 3**: requiere webhooks de todas las redes + pipeline de datos, y aplica solo después de que Social Publisher tenga 3+ meses de datos. La entrada en nav está `hidden: true` a propósito.
5. **Limpieza de ramas:**
   - `feat/telegram-alerts` — ELIMINADA (ahead: 0, 100% en main) + worktree `.worktrees/feat-telegram-alerts` removido.
   - `feat/vps-api-migration-v3` — ELIMINADA (ahead: 0, 100% en main).
   - `fix/sidebar-routes-and-404` y `security/login-hardening-csp-report-only` — **contenido ya absorbido en main** (admin-routes.ts, not-found.tsx ×2, sidebar-coming-soon-item.tsx, CSP Report-Only en middleware.ts:85) pero con hashes distintos. Candidatas a eliminar cuando Miguel confirme.

### Pendientes vivos

1. **Login en dev.pixeltec.mx** — agregar `dev.pixeltec.mx` a Firebase Console → Authentication → Settings → Authorized domains (proyecto `studio-1487114664-78b63`). **Paso manual de Miguel**, no automatizable.
2. **Deploy al VPS** — main sigue adelante de producción. Solo cuando Miguel lo pida.
3. Post-deploy (backlog): hardening binding 127.0.0.1, redirects 302→301, CSP Phase 2 (enforcement tras revisar `cspViolations`), auditoría legal externa.

---

## Sesión 2 — Execution Workspace Redesign (COMPLETO)

**Fecha:** 2026-06-26  
**Estado al cerrar:** TODO COMPLETO Y PUSHEADO A origin/main

### Qué se terminó

Rediseño completo de `/proyectos/[id]/sesion` — el "Centro de Ejecución Inteligente". 12 tareas via SDD, todas revisadas y pusheadas.

**HEAD:** `aede639` · tsc: 0 errores · build: ✓ verde · pushed: ✓

#### Componentes nuevos / modificados
- `WorkspaceHeader` — Mission Control: timer hero `1.375rem mono`, health dot verde/ámbar/rojo, breadcrumb truncable, `≤72px`
- `SessionGoals` — max 3 objetivos, add/toggle/remove live
- `ActivityWorkspace` — timeline unificado: in-progress pinned, inline edit, duración en completadas, estimación 15/30/60min, confirm dialog para reemplazar
- `SessionObservations` — 4 tipos (💡⚠🐞✅), inmutables, left-border por tipo, "➜ Resumen" hover
- `BlockTracker` — 3 estados (active/waiting/resolved), impact + source, tiempo-bloqueado display
- `ExecutionAssistant` — panel "Dev Assistant": health heuristic, contexto live, secciones colapsables, 5 prompts + input libre, Copy/Save-as-observación/Save-to-bitácora
- `EndSessionDialog` — step de revisión de bloqueos, sin `coachResponses`
- `WorkspaceLayout` — 70/30 rewired, `bitacoraAI` → `crm.addProjectLogEntry`

#### Eliminados
`SessionTimer`, `CurrentActivity`, `ActivityTimeline`, `QuickNotepad`, `BlockReporter`, `SmartSidebar`, `SessionAICoach`

### Cambios uncommitted preexistentes (NO tocar)
`.env.example`, `next.config.ts`, `src/app/(admin)/crecimiento/publisher/page.tsx`, `src/app/api/auth/meta/callback/route.ts`, `src/app/api/auth/session/route.ts`, `src/lib/documents/ia-templates.ts`, `src/lib/growth/actions/social-accounts.ts`, `src/middleware.ts`

### Para reanudar en nueva sesión

```
Continuamos en PixelTEC OS. Terminé el Execution Workspace Redesign — 12 tareas
completas y pusheadas a origin/main (HEAD: aede639, tsc clean, build verde).

Se construyó el "Centro de Ejecución Inteligente" para /proyectos/[id]/sesion:
WorkspaceHeader (Mission Control con timer hero), SessionGoals, ActivityWorkspace
(timeline unificado con inline edit), SessionObservations (4 tipos tipados),
BlockTracker (3 estados + impact/source), ExecutionAssistant (Dev Assistant panel
con 5 prompts IA + contexto live), EndSessionDialog con blockers-review gate, y
WorkspaceLayout completamente rewired en 70/30.

Hay cambios uncommitted preexistentes en .env.example, next.config.ts y archivos
de growth/ — NO son parte de este trabajo, no los toques.

Lee git log --oneline -5 para verificar estado real. ¿Por dónde seguimos?
```

---

## Sesión 1 — handoff para continuar

## Contexto del proyecto

- **Repo:** `/home/ubuntu/pixeltec-os` (Next.js 15, App Router, Turbopack)
- **Dev server:** `npm run dev -- --turbopack -p 9002`, accesible en `https://dev.pixeltec.mx`
- **Infra nginx:** `/home/ubuntu/pixeltec-infra/nginx/conf.d/dev.pixeltec.mx.conf`
- **CRÍTICO:** NUNCA hacer deploy al VPS sin que Miguel lo pida explícitamente

## Qué se hizo en esta sesión

Esta sesión cubrió Sprint 5 del Growth Suite y varias correcciones del sistema:

1. **WebSocket HMR** — nginx `dev.pixeltec.mx.conf` tiene bloque dedicado `/_next/webpack-hmr` con `proxy_read_timeout 86400s`
2. **CSP `unsafe-eval`** — `src/middleware.ts` agrega `'unsafe-eval'` en dev para silenciar Turbopack
3. **`allowedDevOrigins`** — `next.config.ts` incluye `'dev.pixeltec.mx'`
4. **Meta OAuth** — botones "Conectar con Meta" cambiados de `<Link>` a `<a>` (3 instancias en `publisher/page.tsx`)
5. **OAuth callback** — `src/app/api/auth/meta/callback/route.ts`: fix `expires_in ?? 60 days`, guarda FB page + IG por separado
6. **Firestore undefined** — `src/lib/growth/actions/social-accounts.ts`: strip undefined antes de escribir
7. **Tareas → campo `important`** — types, schemas, actions, task-form-dialog, task-card actualizados
8. **Notificación WhatsApp tarea importante** — `setTaskStatus` en tasks.ts envía mensaje al completar
9. **Cron recordatorio** — `src/app/api/cron/asistente/task-reminder/route.ts` creado y funcionando
10. **Rutas 404** — `src/lib/routes/admin-routes.ts`: agregados `'documentos'` e `'ia-factory'`

## Estado actual — PENDIENTE DE RESOLVER

### Problema: usuario no puede iniciar sesión en `dev.pixeltec.mx`

**Síntomas en consola:**
- `/api/vps/status` → 401 (sin sesión)
- `FirebaseError: Missing or insufficient permissions` en `PropuestaTab.tsx:67`

**Causa probable:** `dev.pixeltec.mx` NO está en los **Authorized Domains** de Firebase Authentication.

**Solución inmediata:**
1. Firebase Console → proyecto `studio-1487114664-78b63`
2. Authentication → Settings → Authorized domains
3. "Add domain" → `dev.pixeltec.mx`

Después de agregar el dominio, el login en `https://dev.pixeltec.mx/login` debería funcionar.

### Pendiente después de que el login funcione

- Verificar que `/documentos` carga correctamente con sesión activa
- Verificar que `/ia-factory` carga correctamente
- **Growth Analytics** (`/crecimiento/analytics`) — único feature pendiente del Growth Suite, está en `hidden: true` en nav
- **Commit** de todos los cambios de esta sesión (8+ archivos modificados)

## Último mensaje enviado al usuario

> Bien — sí estás en alguna página (no en login), y los dos errores son por sesión nula.
>
> El error más probable: **`dev.pixeltec.mx` no está en los dominios autorizados de Firebase**, entonces `signInWithEmailAndPassword` lanza `auth/unauthorized-domain` silenciosamente.
>
> **Solución en 2 pasos:**
>
> **Paso 1 — Agregar el dominio en Firebase Console:**
> 1. Ve a Firebase Console → proyecto `studio-1487114664-78b63`
> 2. Authentication → Settings → Authorized domains
> 3. "Add domain" → `dev.pixeltec.mx` → confirma
>
> **Paso 2 — Verificar:**
> Después de agregar el dominio, ve a `https://dev.pixeltec.mx/login` e intenta iniciar sesión. Si sigue fallando, abre la consola (F12) justo antes de dar clic en "Iniciar Sesión" y dime qué error nuevo aparece.
>
> El `PropuestaTab.tsx:67` que ves en la consola es de una página de portal de cliente — esa también falla por falta de sesión, no es un bug de código.

---

## Para reanudar en la otra sesión

Copia y pega esto al abrir la nueva sesión de Claude Code:

> Estamos trabajando en PixelTEC OS (`/home/ubuntu/pixeltec-os`). Retomamos de una sesión anterior donde quedó pendiente: el usuario no puede iniciar sesión en `dev.pixeltec.mx` — probable causa: `dev.pixeltec.mx` no está en los Authorized Domains de Firebase (proyecto `studio-1487114664-78b63`). El paso pendiente es agregar ese dominio en Firebase Console → Authentication → Settings → Authorized domains. Después de eso, verificar `/documentos` e `/ia-factory`, y hacer commit de los cambios de sesión. El detalle completo está en `pixeltecpend.md` en la raíz del repo.
