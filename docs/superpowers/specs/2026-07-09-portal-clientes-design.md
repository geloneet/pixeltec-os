# Portal de Clientes v2 — Diseño

**Fecha:** 2026-07-09
**Estado:** Aprobado para implementación

## Contexto

pixeltec-os llegó a tener **tres** sistemas de "portal de cliente" coexistiendo en el código (OTP por correo en `/[slug]`, contraseña en `/portal`, y link público por token en `/portal/[token]`), cada uno con su propia tabla/columnas y su propio mecanismo de acceso. Miguel entró a un link de portal esperando el flujo por correo y aterrizó en la vista pública por token — la confusión reveló que ningún admin sabía ya cuál sistema generaba qué link. Se decidió borrar los tres por completo (código, rutas, componentes; la base de datos quedó intacta) y diseñar **un solo portal nuevo, simple, desde cero**.

Este documento especifica ese portal nuevo.

## Alcance

**Incluye:**
- Una única ruta pública `/portal` con acceso por correo + código OTP.
- Dashboard de cliente: proyectos, facturas, documentos/contratos firmados, tickets de soporte (solo lectura), feed de actualizaciones.
- Control admin en `/portal-admin` (panel propio, no dentro de `/clientes/[id]` — ver sección "Control admin"): activar/desactivar el portal por cliente, publicar actualizaciones del feed.
- Endpoint de descarga de contrato con su propia validación de sesión de portal.

**No incluye (fuera de alcance del MVP):**
- Creación de tickets de soporte desde el portal (solo lectura).
- Migración de `finances`/`tickets` de matching por nombre a `clientId` (ver "Deuda técnica").
- Cualquier mecanismo de slug, token público o link mágico — el único punto de entrada es `/portal` + correo.
- Deploy a producción — requiere autorización explícita de Miguel, igual que el resto del proyecto.

## Arquitectura

### Rutas

- **`/portal`** — única ruta. Server component: lee la cookie de sesión de portal.
  - Sin sesión válida → renderiza `<PortalLoginClient>` (formulario correo → código OTP).
  - Con sesión válida → revalida `clients.portalAccessEnabled` en vivo (no confía solo en la cookie) y renderiza el dashboard con datos de ese cliente. Si `portalAccessEnabled` ya es `false`, limpia la cookie y cae de vuelta al formulario de login, sin mostrar un error.
- **`/api/portal/contract-pdf`** — endpoint nuevo, GET, `?contractId=`. Valida la cookie de sesión de portal (no la sesión admin) y que el contrato pertenezca al `clientId` de esa sesión antes de generar el PDF. Ruta API (no server action) porque necesita devolver un binario, igual que `contract-pdf` admin.
- **Server actions** en `src/app/actions.ts` (mismo patrón que el resto del proyecto) — `requestClientPortalCodeAction`, `verifyClientPortalCodeAction`, `logoutClientPortalAction`. No se crea una ruta API separada para esto.

No hay rutas por slug ni por token. El middleware no necesita ninguna validación especial de segmento único (a diferencia del sistema OTP viejo, que validaba `/[slug]` contra la tabla `clients` en cada request).

### Sesión

- Cookie httpOnly, `secure`, `sameSite=lax`, nombre `__client_portal_session`.
- Payload firmado con HMAC (`PORTAL_SESSION_SECRET`, env var ya existente en `.env.production` — quedó del sistema viejo, sin uso hoy, se reutiliza el nombre).
- Payload: `{ clientId, exp }` — `exp` explícito dentro del payload firmado (no depender solo del `Max-Age` del cookie, que el navegador puede ignorar).
- Duración: 7 días.
- Verificación de firma + `exp` en cada request al dashboard; si cualquiera falla, se trata como "sin sesión".

## Modelo de datos

### Columna nueva (única)

```
clients.portalAccessEnabled: boolean not null default false
```

Interruptor manual — un cliente solo puede pedir/usar el OTP si este flag es `true`. Se controla desde el panel `/portal-admin` (ver sección "Control admin").

### Columnas reusadas de `clients` (ya existen, sin cambios de schema)

| Columna | Uso en el portal nuevo |
|---|---|
| `email` | Identifica al cliente al pedir el código. |
| `accessCodeHash` | Hash del OTP vigente (`HMAC-SHA256(code, PORTAL_SESSION_SECRET)`, no `sha256` plano). |
| `accessCodeExpiresAt` | Expiración del OTP (10 min desde que se generó). |
| `lastCodeRequestAt` | Rate limit por cliente (60s entre solicitudes). |

Ninguna otra columna de portal (`slug`, `portalToken`, `legacyPasswordHash`, `legacyPortalEnabled`, `portalEnabled`) se usa en este diseño — quedan como datos históricos inertes de los sistemas borrados, sin tocar.

### Fuentes de contenido (tablas ya existentes, sin duplicar)

| Sección del dashboard | Tabla | Filtro |
|---|---|---|
| Proyectos | `projects` | `clientId = clients.id` |
| Facturas | `finances` | `clientName = clients.name` (ver deuda técnica) |
| Documentos y contratos | `contracts` | `clientId = clients.id AND status = 'firmado'` |
| Tickets de soporte (solo lectura) | `tickets` | `cliente = clients.name` (ver deuda técnica) |
| Feed de actualizaciones | `clientPortalUpdates` | `clientId = clients.id`, orden cronológico desc |

`clientPortalProjects` (tabla dedicada del sistema de portal viejo, con `clientId` pero shape reducido) **no se usa** — se reemplaza por la tabla real `projects`, que ya tiene el comentario "Estado visible en el portal de clientes" en el schema y es la fuente de verdad que también ve el admin.

### Deuda técnica heredada (documentada, no se resuelve en este proyecto)

`finances.clientName` y `tickets.cliente` son columnas de texto libre, no FK a `clients.id` — heredado de la migración desde Firestore. El portal nuevo hereda el mismo matching por nombre que ya usa el resto de la app (incluido el portal legado ya borrado). Esto es aceptable para el MVP pero es frágil: un cambio de nombre de cliente en `clients.name` desincroniza el matching. Migrar `finances`/`tickets` a `clientId` es trabajo futuro, fuera de alcance aquí.

## Flujo OTP

1. **Solicitar código** (`requestClientPortalCodeAction(email)`):
   - Rate limit por IP (10/hora, bucket `client_portal_otp`, reusa `enforceRateLimit`).
   - Busca clientes con ese correo exacto.
   - **Cero o más de un cliente con el mismo correo** → mismo mensaje genérico de éxito ("Si el correo existe y tiene portal activo, te enviamos un código"), sin enviar nada. La ambigüedad de múltiples clientes con el mismo correo se rechaza de forma determinística — no se autentica contra una fila al azar (misma regla que el hotfix de seguridad de la Sesión 4 del portal legado).
   - Si hay exactamente un cliente Y `portalAccessEnabled=true`: rate limit por cliente (60s vía `lastCodeRequestAt`), genera código de 6 dígitos, guarda `accessCodeHash = HMAC-SHA256(code, PORTAL_SESSION_SECRET)` y `accessCodeExpiresAt = now + 10min`, envía por Resend.
   - Si el envío de email falla, se devuelve error real — nunca se dice "código enviado" si el transporte falló (lección aplicada ya en el hotfix del Diagnóstico Inteligente, Sesión 4).
2. **Verificar código** (`verifyClientPortalCodeAction(email, code)`):
   - Busca el cliente (mismo criterio anti-ambigüedad que arriba).
   - Compara `HMAC-SHA256(code, PORTAL_SESSION_SECRET)` contra `accessCodeHash` en tiempo constante (`crypto.timingSafeEqual`).
   - Verifica `accessCodeExpiresAt > now`.
   - Si es válido: limpia `accessCodeHash` y `accessCodeExpiresAt` (uso único) y emite la cookie de sesión firmada.
   - Mensajes de error distintos para "código incorrecto" vs. "código expirado".
3. **Logout** (`logoutClientPortalAction()`): borra la cookie de sesión.

## Contenido del dashboard

Grid de tarjetas (mismo patrón visual que el portal viejo por contraseña, `InfoCard`):

- **Proyectos** — nombre + status.
- **Facturas** — monto, fecha, status.
- **Documentos y contratos** — contratos firmados, con link de descarga vía `/api/portal/contract-pdf`.
- **Tickets de soporte** — problema, categoría, estado. Solo lectura.
- **Actualizaciones** — feed cronológico (texto + imagen opcional), publicado por el admin.

Cada tarjeta muestra un estado vacío propio cuando no hay datos (mismo patrón ya usado: "No hay proyectos activos.", etc.) — no se oculta la tarjeta ni se muestra un error.

## Control admin

**Corrección post-diseño (2026-07-09, durante planeación):** `/clientes` y `/clientes/[id]` (`ClientWorkspace`) obtienen sus datos de `useCRM()` → `getFullCrmData()`, que filtra explícitamente `source='crm_blob'` (`src/lib/db/repos/crm-sync.ts:461`). De los 13 clientes reales, solo 3 son `crm_blob` — los otros 10 (`source='portal'`) no aparecen en `/clientes` en absoluto. Poner el control del portal dentro de `ClientWorkspace` lo haría alcanzar solo a 3 de 13 clientes, violando el requisito de "todos los clientes sin importar su source". Se decidió **no** extender `useCRM()` (mezclaría responsabilidades y arriesgaría los ~18 archivos que lo consumen) y en su lugar construir un panel admin **separado**, mismo patrón que ya existía en el `/portal-legado` borrado.

**Panel nuevo: `/portal-admin`** (ruta plana, mismo nivel que `/clientes`, `/vps`, `/blog-admin` — este proyecto no usa un prefijo `/admin/...`, así que no se introduce uno solo para este módulo):

- Lista **todos** los clientes del owner (sin el filtro `source='crm_blob'`), vía `listAllClientsForPortalAdmin()` en `src/lib/client-portal/pg.ts` — capa de datos propia, independiente de `useCRM()`/`crm-sync.ts`.
- Por cliente: interruptor "Portal activo" → escribe `clients.portalAccessEnabled`.
- Por cliente: composer simple (texto + imagen opcional URL) → inserta en `clientPortalUpdates` con `createdBy` del admin actual.
- Sin generación de link, slug ni token — nada que copiar/compartir. El cliente siempre entra por `pixeltec.mx/portal` con su propio correo.
- Sigue la misma convención de todos los dominios de `src/lib/` (capa `pg.ts` + archivo de server actions por dominio) — sin carpeta `services/` nueva, sin prefijo de ruta nuevo. Prioridad: consistencia con el proyecto existente sobre cualquier reorganización teórica.

## Seguridad

- **Anti-enumeración**: la respuesta de "solicitar código" es idéntica exista o no el correo, esté o no activo el portal.
- **Anti-ambigüedad**: correos duplicados entre clientes → rechazo determinístico, nunca autenticación al azar.
- **Rate limiting**: por IP (10/hora) y por cliente (60s).
- **OTP**: hash HMAC (no reversible, no `sha256` plano), comparación en tiempo constante, expira en 10 min, uso único (se limpia al verificar).
- **Cookie**: httpOnly, secure, sameSite=lax, firmada, `exp` explícito en el payload, 7 días.
- **Revalidación en caliente**: `portalAccessEnabled` se vuelve a chequear en cada carga del dashboard y en el endpoint de descarga de contrato — desactivar el portal corta el acceso en la siguiente request, sin esperar a que expire la cookie.
- **Anti-IDOR en descarga de contrato**: `/api/portal/contract-pdf` verifica que el `contract.clientId` coincida con el `clientId` de la sesión de portal antes de generar el PDF — un cliente no puede descargar el contrato de otro cambiando el `contractId` en la URL.

## Manejo de errores

| Caso | Comportamiento |
|---|---|
| Correo vacío/inválido | Error de validación de formulario, sin llamar al backend. |
| Correo sin cliente / portal desactivado | Mensaje genérico de éxito (anti-enumeración), sin enviar código. |
| Correo duplicado entre clientes | Mismo mensaje genérico, sin enviar código. |
| Envío de email falla (Resend) | Error real, no se dice "código enviado". |
| Código incorrecto | "Código incorrecto." |
| Código expirado | "El código expiró. Solicita uno nuevo." |
| Rate limit excedido (IP o cliente) | "Demasiadas solicitudes" / "Espera Xs antes de solicitar otro código." |
| `portalAccessEnabled=false` con cookie aún válida | Cookie se limpia, se muestra el formulario de login — no un mensaje de error. |
| Tarjeta sin datos (sin proyectos/facturas/contratos/tickets) | Estado vacío específico de la tarjeta. |
| Descarga de contrato ajeno (`clientId` no coincide) | 403. |

## Checklist de verificación

- [ ] `node_modules/.bin/tsc --noEmit` — 0 errores.
- [ ] `npm run lint` — sin errores nuevos.
- [ ] Migración de `portalAccessEnabled` aplicada y verificada en la base de datos de desarrollo.
- [ ] Cliente de prueba con `portalAccessEnabled=true`: solicitar código → recibir email → verificar → ver dashboard con datos reales (proyectos/facturas/contratos/tickets/feed).
- [ ] Cliente con `portalAccessEnabled=false`: solicitar código → mensaje genérico, sin email real enviado.
- [ ] Dos clientes de prueba con el mismo correo: solicitar/verificar código → rechazo por ambigüedad.
- [ ] Código incorrecto y código expirado → mensajes correctos, sin autenticar.
- [ ] Descargar un contrato propio desde el portal → PDF válido.
- [ ] Intentar descargar un contrato de otro cliente (manipulando `contractId`) → 403.
- [ ] Con sesión de cliente abierta, admin desactiva `portalAccessEnabled` → la siguiente carga del dashboard expulsa al cliente al login.
- [ ] Admin publica una actualización desde `/portal-admin` → aparece en el feed del cliente.
- [ ] `/portal-admin` lista clientes `source='crm_blob'` y `source='portal'` por igual (no solo los que aparecen en `/clientes`).
- [ ] Logout limpia la cookie correctamente.
- [ ] Todas las tarjetas sin datos muestran su estado vacío, no un error.

## Criterio de producción

**Sin deploy a producción bajo ninguna circunstancia hasta que Miguel lo autorice explícitamente** — misma regla vigente para todo el proyecto desde la Sesión 1. El trabajo se valida en `dev.pixeltec.mx` con clientes de prueba creados y borrados en la misma sesión, sin tocar datos de clientes reales.
