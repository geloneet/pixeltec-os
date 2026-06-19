# PixelTEC OS — Backlog Attack Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los 6 ítems pendientes del backlog operativo post-IA-redesign.

**Architecture:** 5 tracks independientes (se pueden atacar en cualquier orden excepto CSP Phase 2 que es time-gated). Cada tarea produce un commit deployable. Los tracks de Next.js requieren `docker compose build --no-cache app && docker compose up -d --force-recreate app && docker exec pixeltec-nginx nginx -s reload`.

**Tech Stack:** Next.js 15 App Router, Docker Compose, nginx, Firebase Firestore, Telegram Bot API.

---

## Hallazgos pre-plan (auditados 2026-06-16)

- **Puerto 3001 (pipas):** Ya NO está expuesto. `docker-compose.yml` en infra solo tiene `networks: web-network` sin `ports:`. Deuda cerrada.
- **Puerto 9000 (webhook):** No hay proceso corriendo en 9000 (`ss -tlnp | grep 9000` → vacío). Deuda cerrada.
- **PORTS.md:** Desactualizado — sigue listando ambos puertos como deudas. Debe corregirse.
- **pixelbet PM2:** Status `errored`. Fuera del scope de este plan pero vale la pena investigar.
- **vps-api PM2:** Ya en v3.0.0 (`version: 3.0.0`). La migración v3 ya está deployada.

---

## Tarea 1: Actualizar PORTS.md y cerrar deudas documentadas

**Files:**
- Modify: `/home/ubuntu/pixeltec-infra/PORTS.md`

**Contexto:** Las deudas de puerto 3001 y 9000 ya están resueltas pero PORTS.md las sigue marcando como `🔴 DEUDA`. Limpiar para que la documentación refleje la realidad.

- [ ] **Step 1: Editar PORTS.md en pixeltec-infra**

  En `/home/ubuntu/pixeltec-infra/PORTS.md`, actualizar las filas de puerto 3001 y 9000:

  ```markdown
  | 3001 | — | — | pipas-container | — | ✅ CERRADO: pipas usa solo web-network, sin binding de host |
  | 9000 | — | — | webhook (PM2) | — | ✅ CERRADO: proceso webhook ya no está corriendo |
  ```

  Y en la sección "Deudas de seguridad" cambiar el estado a resuelto o eliminar las filas.

- [ ] **Step 2: Commit en pixeltec-infra**

  ```bash
  cd /home/ubuntu/pixeltec-infra
  git add PORTS.md
  git commit -m "docs: marcar deudas de puertos 3001 y 9000 como cerradas"
  ```

---

## Tarea 2: Redirects 302 → 301 en next.config.ts

**Files:**
- Modify: `next.config.ts` (líneas 26-33)

**Contexto:** 6 redirects del IA redesign se deployaron con `permanent: false` (302) para poder revertir durante el rollout. Ya llevamos semanas estables — tiempo de convertirlos a 301. **Advertencia:** los 301 son cacheados por browsers y CDNs. Si necesitas revertir alguno, deberás purgar la caché de Cloudflare.

- [ ] **Step 1: Cambiar los 6 redirects a permanent: true**

  En `next.config.ts`, en el bloque de redirects del IA redesign (líneas ~26-33), cambiar todos los `permanent: false` a `permanent: true`:

  ```typescript
  // ── IA Redesign — Semana 1 route migration ──
  { source: '/dashboard', destination: '/hoy', permanent: true },
  { source: '/dashboard/:path*', destination: '/hoy', permanent: true },
  { source: '/asistente', destination: '/tareas', permanent: true },
  { source: '/asistente/:path*', destination: '/tareas/:path*', permanent: true },
  { source: '/herramientas', destination: '/accesos', permanent: true },
  { source: '/herramientas/:path*', destination: '/accesos/:path*', permanent: true },
  ```

- [ ] **Step 2: Verificar que typecheck pasa**

  ```bash
  npx tsc --noEmit
  # Esperado: sin errores
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add next.config.ts
  git commit -m "feat(routing): convertir redirects IA redesign de 302 a 301"
  ```

- [ ] **Step 4: Deploy**

  ```bash
  docker compose build --no-cache app
  docker compose up -d --force-recreate app
  docker exec pixeltec-nginx nginx -s reload
  ```

- [ ] **Step 5: Verificar redirección 301**

  ```bash
  curl -sI --compressed https://pixeltec.mx/dashboard | grep -E "HTTP|location"
  # Esperado:
  # HTTP/2 301
  # location: https://pixeltec.mx/hoy
  ```

---

## Tarea 3: Merge fix/sidebar-routes-and-404 (cherry-pick selectivo)

**Files:**
- Create: `src/lib/routes/admin-routes.ts`
- Create: `src/components/nav/sidebar-coming-soon-item.tsx`
- Modify: `src/middleware.ts` (importar desde admin-routes.ts — NO usar la versión de la rama)
- Modify: `src/app/(admin)/not-found.tsx`
- Modify: `src/app/not-found.tsx`

**Contexto:** La rama `fix/sidebar-routes-and-404` tiene 4 commits útiles pero su `middleware.ts` es OBSOLETO (no tiene el CSP/nonce del security commit). Hay que cherry-pick solo los archivos buenos y remendar middleware.ts manualmente.

Los 4 commits son:
- `8009b18` — admin-routes.ts (single source of truth) + modifica middleware.ts ← **CONFLICTO, tratar con cuidado**
- `cc12481` — SidebarComingSoonItem ← cherry-pick limpio
- `53746f9` — 404 dentro del shell admin
- `2723da6` — 404 standalone para rutas no autenticadas

- [ ] **Step 1: Cherry-pick admin-routes.ts (solo el archivo nuevo)**

  ```bash
  # Cherry-pick del commit que crea admin-routes.ts, pero ignorando middleware.ts
  git checkout fix/sidebar-routes-and-404 -- src/lib/routes/admin-routes.ts
  ```

  El archivo `src/lib/routes/admin-routes.ts` debe quedar así (verificar que exista y contenga):

  ```typescript
  export const ADMIN_ROUTES = [
    'hoy', 'tareas', 'proyectos', 'clientes', 'cobros', 'accesos',
    'vps', 'portal', 'crypto-intel', 'perfil', 'notificaciones', 'blog-admin',
  ] as const;

  export type AdminRoute = typeof ADMIN_ROUTES[number];

  export const PROTECTED_PATHS = ADMIN_ROUTES.map(r => `/${r}`);

  export const KNOWN_ROUTES = new Set<string>([
    ...ADMIN_ROUTES,
    'about', 'contact', 'services', 'blog', 'metodologia', 'equipo',
    'industrias', 'privacy-policy', 'aviso-de-privacidad', 'terminos-de-servicio',
    'data-deletion', 'guias-transformacion', 'login', 'api',
  ]);
  ```

  **Nota:** verificar que la lista de ADMIN_ROUTES en la rama incluya todas las rutas actuales (`tareas`, `cobros`, `accesos`). Si faltan, agregarlas.

- [ ] **Step 2: Actualizar middleware.ts para importar desde admin-routes.ts**

  En `src/middleware.ts`, reemplazar las definiciones inline de `PROTECTED_PATHS` y `KNOWN_ROUTES` con imports:

  ```typescript
  import { PROTECTED_PATHS, KNOWN_ROUTES } from '@/lib/routes/admin-routes';
  ```

  Y eliminar los bloques `const PROTECTED_PATHS = [...]` y `const KNOWN_ROUTES = new Set([...])` que estaban hardcodeados.

- [ ] **Step 3: Cherry-pick SidebarComingSoonItem**

  ```bash
  git checkout fix/sidebar-routes-and-404 -- src/components/nav/sidebar-coming-soon-item.tsx
  ```

- [ ] **Step 4: Cherry-pick la 404 del shell admin**

  ```bash
  git checkout fix/sidebar-routes-and-404 -- src/app/(admin)/not-found.tsx
  ```

- [ ] **Step 5: Cherry-pick la 404 standalone**

  ```bash
  git checkout fix/sidebar-routes-and-404 -- src/app/not-found.tsx
  ```

- [ ] **Step 6: Typecheck**

  ```bash
  npx tsc --noEmit
  # Esperado: sin errores
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add src/lib/routes/admin-routes.ts src/middleware.ts \
          src/components/nav/sidebar-coming-soon-item.tsx \
          src/app/(admin)/not-found.tsx src/app/not-found.tsx
  git commit -m "feat(routing): admin-routes.ts single source of truth + SidebarComingSoonItem + 404 redesign"
  ```

- [ ] **Step 8: Deploy y verificar**

  ```bash
  docker compose build --no-cache app
  docker compose up -d --force-recreate app
  docker exec pixeltec-nginx nginx -s reload
  curl -sI --compressed https://pixeltec.mx/ruta-inexistente | grep HTTP
  # Esperado: HTTP/2 404
  ```

---

## Tarea 4: Merge feat/telegram-alerts

**Files:**
- Create: `src/lib/notifications/telegram.ts`
- Create: `src/lib/notifications/types.ts`
- Create: `src/lib/notifications/infra-bot.ts`
- Create: `src/lib/notifications/silence.ts`
- Create: `src/lib/notifications/telegram-auth.ts`
- Create: `src/app/api/notifications/alert/route.ts`
- Create: `src/app/api/notifications/telegram/webhook/route.ts`
- Modify: `src/app/(admin)/tareas/` (renombrado desde asistente)

**Contexto:** La rama `feat/telegram-alerts` está en el worktree `.worktrees/feat-telegram-alerts`. Tiene el sistema de notificaciones Telegram completo. La rama también renombró `/asistente` → `/tareas` (alineado con el IA redesign).

- [ ] **Step 1: Verificar estado del worktree y que la rama no tiene conflictos con main**

  ```bash
  cd /home/ubuntu/pixeltec-os/.worktrees/feat-telegram-alerts
  git log --oneline main..feat/telegram-alerts
  # Listar los commits pendientes de merge
  ```

- [ ] **Step 2: Revisar si la rama tiene la versión actualizada del middleware (con CSP)**

  ```bash
  grep -n "Content-Security-Policy" /home/ubuntu/pixeltec-os/.worktrees/feat-telegram-alerts/src/middleware.ts
  # Si NO aparece CSP → la rama tiene middleware viejo, necesitamos resolver conflicto
  ```

- [ ] **Step 3a (si NO tiene CSP en middleware): Rebase sobre main**

  ```bash
  cd /home/ubuntu/pixeltec-os/.worktrees/feat-telegram-alerts
  git rebase main
  # Resolver conflictos en middleware.ts si aparecen:
  # Mantener la versión de main (con CSP) + agregar los imports que la rama necesite
  ```

- [ ] **Step 3b (si SÍ tiene CSP en middleware): Merge directo**

  ```bash
  cd /home/ubuntu/pixeltec-os
  git merge feat/telegram-alerts --no-ff -m "feat(notifications): merge telegram alerts system"
  ```

- [ ] **Step 4: Verificar variables de entorno requeridas**

  Revisar qué variables nuevas necesita el sistema de Telegram:
  ```bash
  grep -r "process.env\." /home/ubuntu/pixeltec-os/src/lib/notifications/ | grep -v "node_modules"
  ```

  Agregar las variables faltantes a `.env.production` en el VPS.

- [ ] **Step 5: Typecheck**

  ```bash
  npx tsc --noEmit
  # Esperado: sin errores
  ```

- [ ] **Step 6: Commit (si se hizo rebase)**

  ```bash
  git add -A
  git commit -m "feat(notifications): sistema de alertas Telegram — endpoint + webhook bot"
  ```

- [ ] **Step 7: Deploy**

  ```bash
  docker compose build --no-cache app
  docker compose up -d --force-recreate app
  docker exec pixeltec-nginx nginx -s reload
  ```

- [ ] **Step 8: Smoke test del endpoint de alerta**

  ```bash
  curl -sX POST https://pixeltec.mx/api/notifications/alert \
    -H "Content-Type: application/json" \
    -d '{"message": "test smoke alert"}' | head -c 200
  # Esperado: respuesta JSON con ok:true o error con detalles (no 500)
  ```

---

## Tarea 5: CSP Phase 2 — Activar enforcement (TIME-GATED)

**Prerequisito:** Mínimo 7 días desde el deploy de CSP Report-Only (fue el `b06c869` del 2026-05-08). Ya tenemos más de 30 días → podemos proceder **si la revisión de telemetría lo confirma**.

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Revisar colección cspViolations en Firestore**

  Abrir Firebase Console → Firestore → colección `cspViolations`. Verificar:
  - ¿Hay violaciones de `script-src`? Si sí, ¿de qué origen?
  - ¿Hay violaciones de `connect-src`? ¿Están todos los dominios necesarios en la whitelist?
  - Si hay violaciones de Firebase scripts o Cloudflare → agregar esos dominios antes de activar.

  **STOP:** Solo continuar si no hay violaciones inesperadas (scripts de nuestra propia app no deben violar).

- [ ] **Step 2: Cambiar de Report-Only a enforcing en middleware.ts**

  En `src/middleware.ts`, en la función `withSecurityHeaders`, cambiar:

  ```typescript
  // ANTES:
  res.headers.set('Content-Security-Policy-Report-Only', buildCsp(nonce));

  // DESPUÉS:
  res.headers.set('Content-Security-Policy', buildCsp(nonce));
  ```

  Y eliminar (o comentar) la línea de `Content-Security-Policy-Report-Only` si quieres dejar de recolectar.

- [ ] **Step 3: Typecheck**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **Step 4: Deploy en staging mental — probar con un browser primero**

  Antes de hacer commit, aplicar el cambio manualmente en el VPS corriendo y cargar pixeltec.mx en Chrome. Abrir DevTools → Console. Verificar que NO hay errores de CSP bloqueando scripts.

- [ ] **Step 5: Commit**

  ```bash
  git add src/middleware.ts
  git commit -m "security(csp): activar enforcement — CSP-Report-Only → CSP"
  ```

- [ ] **Step 6: Deploy**

  ```bash
  docker compose build --no-cache app
  docker compose up -d --force-recreate app
  docker exec pixeltec-nginx nginx -s reload
  ```

- [ ] **Step 7: Monitorear post-deploy**

  Durante 10-15 min navegar la app (login, /hoy, /tareas). Si algo se rompe (pantalla en blanco, funcionalidad Firebase bloqueada), revertir cambiando CSP back a Report-Only.

---

## Tarea 6: Aviso de privacidad v2 — Revisión legal (NON-CODE)

**Files:** `docs/legal/aviso-de-privacidad-draft-v2.md` (ya existe)

- [ ] **Step 1: Enviar el draft al abogado LFPDPPP**

  El archivo draft está en `docs/legal/aviso-de-privacidad-draft-v2.md`. Compartir con el abogado para revisión bajo LFPDPPP.

- [ ] **Step 2 (post-revisión): Actualizar `src/app/aviso-de-privacidad/page.tsx`**

  Incorporar el aviso aprobado. Asegurarse de que el componente sea un Server Component (sin `'use client'`) para que Next.js pueda exportar metadata SEO correctamente.

- [ ] **Step 3: Commit y deploy cuando esté aprobado**

  ```bash
  git add src/app/aviso-de-privacidad/page.tsx
  git commit -m "legal: aviso de privacidad v2 — revisión LFPDPPP aprobada"
  docker compose build --no-cache app && docker compose up -d --force-recreate app
  docker exec pixeltec-nginx nginx -s reload
  ```

---

## Orden de ejecución sugerido

| Orden | Tarea | Tiempo estimado | Requiere deploy |
|-------|-------|-----------------|-----------------|
| 1 | Tarea 1 — PORTS.md | 5 min | No |
| 2 | Tarea 2 — Redirects 301 | 10 min | Sí |
| 3 | Tarea 3 — Sidebar/404 | 20-30 min | Sí |
| 4 | Tarea 4 — Telegram alerts | 30-45 min | Sí |
| 5 | Tarea 5 — CSP enforcement | 15 min | Sí (con cuidado) |
| 6 | Tarea 6 — Legal | Bloqueado por abogado | Sí (cuando llegue) |

Las tareas 2, 3 y 4 se pueden batching en un solo deploy si se hacen seguidas.
