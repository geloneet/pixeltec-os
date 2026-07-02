# PixelTEC OS — Sesiones de Continuación

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
