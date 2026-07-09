# PixelTEC OS — Sesiones de Continuación

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
