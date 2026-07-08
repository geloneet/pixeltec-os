# Plan — Migración de pixeltec-os: Firebase → Postgres 16 + Drizzle + NextAuth v5

**Fecha:** 2026-07-07 · **Estado:** PLAN (no ejecutado) · **Autor:** sesión Claude Code

---

## Contexto

El dashboard de pixeltec-os corre hoy 100% sobre Firebase: **Firestore** como base de datos (≈40 colecciones) y **Firebase Auth** como identidad (session cookies `__session` + Admin SDK). Miguel quiere estandarizar todo su stack sobre lo que ya usa por defecto en proyectos nuevos:

| Capa         | Responsabilidad                          | Destino                                   |
| ------------ | ---------------------------------------- | ----------------------------------------- |
| **Database** | Persistencia, schema versionado, migraciones | **Postgres 16 + Drizzle ORM + Drizzle Kit** |
| **Auth**     | Identidad: quién es el usuario           | **NextAuth v5 (Auth.js), sesiones en DB** |

**Ventaja enorme:** el proyecto `dalk` (en el mismo VPS) YA usa exactamente este stack y sirve de implementación de referencia directa:
- `drizzle-orm ^0.45.2`, `drizzle-kit ^0.31.10`, `next-auth ^5.0.0-beta.31`, `@auth/drizzle-adapter ^1.11.2`
- `dalk/drizzle.config.ts` (dialect postgresql, schema en `src/lib/db/schema.ts`, `url` desde `DATABASE_URL`)
- `dalk/src/lib/db/{schema,index}.ts`, `dalk/src/lib/auth/config.ts`, `dalk/src/server/actions/auth.ts` (`signIn`/`signOut` con credentials provider)
- Postgres ya corre como contenedores en el VPS (`dalk-db`, `pixeltec-bodyproject-db`, `pixeltec-barrostock-db`, `pixeltec-edmsolar-db`) → añadir `pixeltec-os-db` sigue un patrón establecido.

Este plan reutiliza la estructura de dalk como plantilla en todo momento.

---

## Alcance real (inventario verificado)

### Datastore — Firestore (≈40 colecciones)
Enumeradas desde `firestore.rules` + grep del código:

- **Núcleo CRM (crítico):** `crm_data/{uid}` — **un blob gigante por usuario** con `clients[]` (→ `projects[]` → `tasks[]`, `charges[]`, `keys[]`, `notesLog[]`), `tools[]`, `streak`, `serverLinks`, `sessions[]`. Es el corazón del dashboard y el mayor reto de modelado (`src/components/crm/CRMContextCore.tsx`).
- **Documentos CRM (scoped por uid):** `proposals`, `contracts`, `invoices`, `strategies`, `ia_templates`, `discovery_sessions`.
- **Portal de clientes:** `clients` (+ subcolecciones `updates`, `projects`), `portalRateLimit`, `portalSecurityEvents`. *(Ya migrado a Admin SDK + sesión OTP propia en la remediación de seguridad — NO usa Firebase Auth.)*
- **Funnel público:** `leads`, `newsletterSubscribers`, `rateLimit`, `systemAlerts`, `authLockouts`.
- **Notificaciones / auditoría:** `notifications`, `activity`, `infraAuditLog`, `cspViolations`.
- **Asistente/tareas:** `tasks`, `assistantWeeklyReports`.
- **Growth Suite:** `growthBrands`, `growthPosts`, `growthCampaigns`, `growthCredits`, `growthCreditLedger`, `growthJobs`, `growthSocialAccounts`.
- **Blog:** `blogBriefs`, `blogPosts`.
- **Legacy/otros:** `tickets`, `finances`, `points`, `users`.

### Colecciones con acoplamiento a servicios EXTERNOS (⚠ coordinación obligatoria)
Estas NO las escribe pixeltec-os — las escribe otro repo/servicio vía Admin SDK. Migrarlas exige cambiar también ese servicio, o mantener un puente temporal:
- **`tenants/**`** (WhatsApp Inbox) — escritas por **pixelbot**; la SQLite del bot es source of truth y el dashboard solo lee una proyección en tiempo real.
- **Crypto-Intel** (`alertRules`, `alerts`, `prices`, `priceSnapshots`, `telegramUsers`, `telegramSessions`, `cryptoIntelLogs`) — escritas por el **bot de Telegram** + crons.

### Auth — Firebase Auth
- Login: `src/app/api/auth/session/route.ts` (`verifyIdToken` → `createSessionCookie`, cookie `__session`, 5d/30d).
- Middleware: `src/middleware.ts` (`verifySessionCookie(checkRevoked)`), protege `PROTECTED_PATHS`.
- Guards de API: `requireSession` (`src/lib/vpsClient.ts`), `requireAdmin` (`src/lib/auth-guards.ts`, basado en `ADMIN_UIDS`), `getSessionUid` (`src/lib/crypto-intel/auth.ts`).
- Cliente: `useUser`, `use-user-profile`, `use-admin` (rol desde doc `users/{uid}`).
- **Identidad = Firebase UID** en todos los `uid`-scoped docs y en `ADMIN_UIDS`.

### Tiempo real
`onSnapshot` / `useCollection` / `useDoc` en ~30 archivos (WhatsApp Inbox, notificaciones, TaskBoard, WorkloadChart, portal admin). Postgres no tiene realtime nativo — decisión por-feature (§Decisiones).

### Fuera de alcance de Postgres (decidir aparte)
- **Firebase Storage** — avatares (`src/components/profile/avatar-uploader.tsx`), logos de marcas Growth (`src/lib/growth/storage/brands.ts`). Postgres no reemplaza blob storage.

---

## Arquitectura destino (espejo de dalk)

```
src/lib/db/
  schema.ts        # todas las tablas Drizzle + relations
  index.ts         # cliente drizzle (pg Pool / postgres.js) desde DATABASE_URL
  migrations/      # (o ./drizzle) generadas por drizzle-kit
drizzle.config.ts  # dialect postgresql, schema, out, DATABASE_URL
src/lib/auth/
  config.ts        # NextAuth v5: DrizzleAdapter, credentials provider, session strategy 'database'
  index.ts         # export { auth, signIn, signOut, handlers }
src/app/api/auth/[...nextauth]/route.ts   # handlers de NextAuth
src/server/actions/auth.ts                # loginAction / logoutAction (patrón dalk)
```

- **DB:** contenedor `pixeltec-os-db` (postgres:16) en `web-network`, bind `127.0.0.1` (regla de seguridad de puertos del VPS — ver [[infra_patterns]]), volumen persistente, `DATABASE_URL` en `.env.production`.
- **Auth:** NextAuth v5 con `@auth/drizzle-adapter`, sesiones en tabla `sessions` (DB strategy), reemplaza la cookie `__session` de Firebase. `middleware.ts` usa `auth()` de NextAuth. `requireAdmin` pasa de `ADMIN_UIDS` (env) a rol en tabla `users`.

---

## Decisiones de diseño que hay que tomar (las difíciles)

1. **`crm_data` blob → modelo relacional normalizado (el reto central).**
   El blob anidado (clients → projects → tasks/charges/keys/notesLog) se normaliza a tablas: `clients`, `projects`, `tasks`, `recurring_charges`, `project_keys`, `project_log_entries`, `tools`, `knowledge_tips`, `work_sessions`, `server_links`, `user_streak`. Esto **elimina de raíz** los bugs de escritura no-transaccional del blob (identificados en la auditoría de seguridad) porque cada entidad se actualiza por su PK. Es el mayor esfuerzo de la migración y define el schema.

2. **Firebase UID → IDs nuevos.** NextAuth genera IDs propios. Se necesita una **tabla de mapeo `firebase_uid → user_id`** durante la migración de datos para reconectar todos los docs `uid`-scoped. Los usuarios existentes (Miguel + equipo) deben re-registrarse o migrarse con set de contraseña (credentials provider) o vía un provider federado.

3. **Reemplazo de tiempo real.** Firestore `onSnapshot` da updates live. Opciones:
   - **CRM general (mayoría):** no necesita realtime duro → SWR + revalidación / `router.refresh()` tras server action. **Recomendado** para casi todo.
   - **WhatsApp Inbox / notificaciones:** sí quieren realtime → Postgres `LISTEN/NOTIFY` + SSE, o polling corto. Decidir por-feature; empezar con polling y subir a SSE si molesta.

4. **Storage.** Recomendación: **mantener Firebase Storage** en la primera etapa (avatares/logos) para no ampliar el alcance; migrar a S3/R2/Supabase Storage como fase posterior independiente. Postgres guarda solo la URL.

5. **Servicios externos (pixelbot, bot Telegram).** Recomendación: **estrategia strangler-fig** — pixeltec-os migra su datastore primero; las colecciones escritas por servicios externos (`tenants/**`, crypto-intel) se quedan en Firestore hasta una fase de coordinación dedicada con esos repos, o se les da un endpoint interno en pixeltec-os que escriba a Postgres. NO migrar estas en la Fase 1.

6. **Portal de clientes.** Ya usa sesión OTP propia (no Firebase Auth), así que su auth no cambia; solo su datastore (`clients`, `updates`, `projects`, portal rate-limit/security-log) migra a Postgres junto con el resto. Las server actions del portal (`src/app/actions.ts`) ya están sobre Admin SDK → cambiar el driver a Drizzle.

7. **Coexistencia durante la migración.** Firebase y Postgres corren **en paralelo** módulo por módulo (patrón strangler-fig). No hay un big-bang. Un flag/rama por módulo permite rollback granular.

---

## Plan por fases (incremental, strangler-fig)

### Fase 0 — Fundaciones (sin tocar features)
- Añadir deps: `drizzle-orm`, `drizzle-kit`, `next-auth@5`, `@auth/drizzle-adapter`, driver `pg`/`postgres`. Copiar versiones exactas de `dalk/package.json`.
- Contenedor `pixeltec-os-db` (postgres:16) en `docker-compose.yml`, bind `127.0.0.1`, volumen, `DATABASE_URL` en `.env.production`.
- `drizzle.config.ts` + `src/lib/db/{schema,index}.ts` vacíos (espejo dalk).
- Verificación: `drizzle-kit push` contra la DB vacía conecta OK; `docker exec pixeltec-os-db psql` responde.

### Fase 1 — Schema relacional + capa de datos
- Diseñar el schema completo en `src/lib/db/schema.ts`: tablas de auth (users/accounts/sessions/verification_tokens del adapter Drizzle) + todas las entidades de negocio (§Decisión 1). Definir `relations()` y FKs.
- Generar migración inicial con `drizzle-kit generate`.
- Escribir **repositorios/queries** tipados que reemplacen cada acceso a Firestore (una capa `src/lib/db/repos/*` por dominio: crm, growth, portal, notifications, blog, asistente).
- Verificación: `drizzle-kit migrate` aplica limpio; tests de round-trip por repo contra una DB de prueba.

### Fase 2 — Auth (NextAuth v5)
- `src/lib/auth/config.ts` con `DrizzleAdapter`, credentials provider (hash de password con `bcrypt`/`argon2`), `session.strategy = 'database'`. Patrón exacto de `dalk/src/lib/auth/config.ts`.
- `src/app/api/auth/[...nextauth]/route.ts`, `src/server/actions/auth.ts` (login/logout).
- Reescribir `middleware.ts` para usar `auth()` en vez de `verifySessionCookie`; reemplazar `requireSession`/`requireAdmin`/`getSessionUid` por helpers sobre la sesión de NextAuth (rol desde tabla `users`).
- Migrar la página `/login` al flujo credentials.
- Reemplazar `ADMIN_UIDS` (env) por columna `role` en `users`.
- Verificación: login/logout end-to-end, ruta admin protegida redirige sin sesión, `requireAdmin` bloquea no-admins, sesión persiste y se revoca en DB.

### Fase 3 — Migración de datos (Firestore → Postgres)
- Script de **export** de todas las colecciones en alcance (Admin SDK → JSON).
- Script de **transform** que aplana `crm_data` blob → filas relacionales y construye la tabla de mapeo `firebase_uid → user_id`.
- Script de **load** idempotente (Drizzle inserts en transacción por usuario).
- **Dry-run** contra DB de staging + validación de conteos y de integridad referencial.
- Estrategia: ventana de mantenimiento corta (freeze de escrituras) o doble-escritura temporal. Recomendado: ventana corta por el tamaño acotado de los datos.
- Verificación: conteos por entidad Firestore == filas Postgres; spot-check de un cliente completo con sus proyectos/tareas/cobros.

### Fase 4 — Corte de features módulo por módulo (strangler-fig)
Orden sugerido (menor riesgo → mayor): blog → notificaciones → funnel público/portal → documentos CRM (proposals/contracts/invoices/etc.) → Growth Suite → **núcleo CRM (`crm_data`)** al final por ser el más grande. Cada módulo: repos Postgres en vez de Firestore, reemplazo de `onSnapshot` por SWR/polling (§Decisión 3), verificación en dev antes de pasar al siguiente.
- Verificación por módulo: `tsc` limpio, flujo real ejercido en `dev.pixeltec.mx`, sin lecturas/escrituras residuales a Firestore (grep).

### Fase 5 — Servicios externos + limpieza (coordinación)
- Coordinar con **pixelbot** y **bot de Telegram** el corte de `tenants/**` y crypto-intel a Postgres (o dejar puente). Requiere trabajo en esos repos.
- Retirar Firebase: quitar `firebase`/`firebase-admin` de deps una vez cero referencias, borrar `firestore.rules`/`storage.rules` si Storage también migró, limpiar env vars.
- Verificación: `grep -rn "firebase" src` sin resultados de datastore/auth; build y smoke test completos.

---

## Riesgos y rollback
- **Pérdida/corrupción de datos en la migración** → dry-runs obligatorios en staging, backups de Firestore export + snapshot de Postgres antes de cada carga, migración por-usuario transaccional.
- **crm_data blob mal normalizado** → es el punto más frágil; validar con round-trip (leer Postgres → reconstruir la vista que espera el front → diff contra el blob original) antes del corte.
- **Sesiones/UID** → mantener la tabla de mapeo hasta confirmar que ningún dato quedó huérfano.
- **Servicios externos** → NO migrar sus colecciones en Fase 1; strangler-fig evita romper pixelbot/Telegram.
- **Rollback:** al ser strangler-fig, cada módulo revierte independiente volviendo su repo a Firestore; Firebase sigue vivo hasta Fase 5.

## Verificación global (al terminar)
- `npm run build` y `tsc --noEmit` limpios.
- `grep -rn "firebase/firestore\|firebase-admin\|firebase/auth" src` → solo lo que quede intencionalmente (Storage, si se mantiene).
- Login NextAuth, CRM (crear cliente/proyecto/tarea/cobro), portal OTP, Growth, notificaciones — todos ejercidos en dev contra Postgres.
- `drizzle-kit migrate` reproducible desde cero en una DB vacía.

## Referencia
Usar `dalk` como plantilla viva: `dalk/drizzle.config.ts`, `dalk/src/lib/db/{schema,index}.ts`, `dalk/src/lib/auth/config.ts`, `dalk/src/server/actions/auth.ts`. Mismo VPS, mismo patrón de contenedor Postgres, misma versión de stack.
