# Cotización aceptada → Proyecto y Finanzas automáticos

**Fecha:** 2026-08-27 · **Aprobado por:** Miguel (CEO) · **Estado:** diseño aprobado

## Contexto

Hoy, cuando se acepta una cotización (`sales/accept.ts`, WO-2026-00106) nace una Venta
con sus cobros — pero de ahí en adelante todo es manual: nadie crea el proyecto, nadie
activa los recurrentes, y no existe ninguna forma (ni automática ni manual) de cobrar un
recurrente una vez que se cumple su fecha. Miguel pidió que, al aceptar y cobrar una
cotización, el proyecto y sus finanzas se arme solo — y pidió explícitamente que esto se
construya bien: **es el primer flujo de este tipo en el dashboard y va a servir de
cimiento para los que siguen.** Eso significa: reusar lo que ya existe en vez de crear
un sistema paralelo (ADR-0057), migraciones limpias con índices de idempotencia (no
"funciona a mano"), funciones puras y testeables donde el resto del código ya las tiene
(`sales/model.ts`, `quotes/terms.ts`), y ningún cron nuevo que reinvente el transporte de
notificaciones que ya existe.

Esta decisión **reemplaza** dos decisiones previas ya escritas:
- WO-2026-00106 §9/§10: los recurrentes nacían `pending_start`, activación 100% manual.
- El límite declarado en `activateRecurring()`: *"no existe scheduler... ADR-0057 dejó
  fuera construir uno."* Este documento SÍ construye ese scheduler (Parte C).

## Disparo — cuándo pasa esto

No es "aceptar la cotización": es el momento en que la Venta se vuelve cobrable de
verdad. `sales/model.ts` ya tiene esa regla (`readyForProject()`): `activa` o
`completada`, derivado de los cobros reales, nunca un booleano aparte. Ese estado se
reconcilia en `syncStatus()` (`sales/actions.ts`), que corre cada vez que se lee la
Venta (`getSaleForQuoteAction` / `getSaleAction`) — es decir, la próxima vez que alguien
abre esa Venta después de que se registró el anticipo.

**Por qué ahí y no en `recordPayment`:** ADR-0057 prohíbe expresamente tocar
`recordPayment` (`documents/billing.ts`). `syncStatus` es el punto ya designado para
reaccionar a cambios de estado de la Venta sin tocar el registro de pagos.

`syncStatus` se extiende así:

```
si sale.status (recién derivado) !== sale.storedStatus:
  guardar el nuevo status (ya existe)
  si readyForProject(nuevo) && !readyForProject(anterior) && sale.projectId es null:
    provisionProjectAndRecurrents(sale)   // Partes A + B, una sola transacción
```

**Riesgo aceptado y declarado:** cualquier Venta que YA esté `activa`/`completada` antes
de este cambio, y que nunca haya tenido un proyecto creado a mano, generará su proyecto
la primera vez que alguien vuelva a abrirla. Dado que PixelTEC OS sigue en
demo/preproducción (ADR-0037) esto se acepta; si aparece un caso real con proyecto ya
creado a mano, `sales.projectId` seguiría null y se duplicaría — se resuelve a mano esa
vez (caso raro, no bloquea el diseño).

## Parte A — Proyecto automático

`provisionProjectAndRecurrents` (nuevo, `src/lib/sales/provision.ts`, sin `db` en la
parte pura / con `db` en la función que ejecuta) crea un `projects` row:

- `name` = `sale.title` (el título de la cotización).
- `clientId` = `sale.clientId`.
- `budget` = `sale.oneTimeTotalCents` convertido a la unidad de `projects.budget`.
- `annual` = el `amount` del `recurringCharges` de frecuencia `annual` de esa venta, si
  existe (0 si la cotización no tenía renovación anual).
- El resto queda en su default (`status: "Activo"`, `domain`, `tech`, etc. vacíos —
  se llenan a mano después, igual que un proyecto creado por el modal manual hoy).

**Migración:** `sales.projectId` (uuid, nullable, FK → `projects.id`, `onDelete: "set
null"`, índice único) — mismo patrón que `projects.contractId`. Sirve como guarda de
idempotencia: si ya tiene `projectId`, `syncStatus` no vuelve a provisionar.

Al crear el proyecto, se actualiza `projectId` en: el `sales` row, todos los
`billingItems` de esa venta, y todos los `recurringCharges` de esa venta (las tres FK ya
existen en el schema — hoy nacen en `null`).

## Parte B — Activación automática de recurrentes (anual y mensual)

En la misma transacción, todo `recurringCharges` de la venta pasa a `status: 'active'`,
`active: true`:

- **Anual:** ya trae `startDate` (el aniversario, `firstAnniversary()` — sin cambios).
- **Mensual:** hoy nace con `startDate: null` ("decisión de operación", comentario de
  Miguel 2026-08-27 en `accept.ts`). Esta decisión se reemplaza: `startDate` = la fecha
  (`YYYY-MM-DD`, hora local de México — mismo criterio que `firstAnniversary()`) del
  momento en que la Venta se volvió cobrable.

`activateRecurring` (la acción manual, botón "Activar recurrente") **se conserva** para
recurrentes que no nacen de este flujo (alta manual desde Finanzas) — deja de ser el
camino normal, pero no es código muerto.

## Parte C — El scheduler que faltaba: vencer un recurrente cobrable de verdad

Esta es la pieza más grande. Un cron nuevo, diario, `src/app/api/cron/recurring-charges/
route.ts` (protegido por `CRON_SECRET`, mismo patrón que `notifications/billing-charges`):

Para cada `recurringCharges` con `status: 'active'`:

1. Calcula el próximo cobro con `getNextChargeDate(startDate, frequency)` — función que
   **ya existe** (`lib/crm/next-charge-date.ts`), no se reescribe.
2. **Si ese cobro ya venció (`<= hoy`)** y no existe todavía un `billing_item` para ese
   período exacto: lo crea — `status: 'pendiente'`, `dueDate` = la fecha vencida,
   `frequency`/`amount`/`concept`/`clientId`/`projectId` copiados del recurrente,
   `recurringChargeId` = el id del recurrente (columna nueva, ver migración). De ahí en
   adelante es 100% el flujo de cobro que ya existe: aparece en `/cobros`, se le registra
   pago con `recordPayment`, sin tocar esa función.
3. **Si todavía no vence**, evalúa los checkpoints de aviso (Parte D).

**Migraciones:**
- `billingItems.recurringChargeId` (uuid, nullable, FK → `recurring_charges.id`,
  `onDelete: "set null"`).
- Índice único en `(recurringChargeId, dueDate)` sobre `billingItems` — es la garantía de
  idempotencia real (no "no debería duplicarse", sino que la base de datos lo impide):
  si el cron corre dos veces el mismo día, el segundo `insert` falla y se ignora.

## Parte D — Notificaciones automáticas por checkpoint

Checkpoints antes de la fecha de vencimiento de cada recurrente:
- **Anual:** 30, 15 y 1 día antes.
- **Mensual:** 2 y 1 día antes.

Mismo transporte que ya existe (email + WhatsApp, el mismo que usa el cron de
ADR-0040/`billing-charges`) — se extrae a una función compartida
`sendBillingReminder(...)` si no está ya aislada, en vez de duplicar el envío en dos
crons.

**Migración de idempotencia:** `lastNotified` (timestamp único) no alcanza para saber
cuáles de los 3 avisos ya se mandaron en el ciclo vigente. Se agrega:
- `recurringCharges.reminderCycleDue` (date, nullable) — la fecha de vencimiento del
  ciclo que se está avisando.
- `recurringCharges.reminderCheckpointsSent` (jsonb, default `[]`) — qué checkpoints
  (`30`/`15`/`2`/`1`) ya se avisaron para `reminderCycleDue`.

Si el próximo cobro calculado (`getNextChargeDate`) cambió respecto a
`reminderCycleDue`, es un ciclo nuevo: se resetea `reminderCheckpointsSent` a `[]` y se
actualiza `reminderCycleDue` — mismo principio que `remindedForDueDate` en
`billingItems`, adaptado a múltiples checkpoints.

Después de que el período vence (Parte C ya generó su `billing_item`), el recurrente dejó
de necesitar avisos automáticos — el aviso de ahí en adelante es el que ya existe para
`billingItems` vencidos/pendientes (ADR-0040), más el recordatorio manual (abajo).

## Parte E — Card "Próximos a vencer" (`/cobros`, global)

Arriba de la tabla de `cobros-view.tsx`: una card con los `recurringCharges` activos cuyo
`getNextChargeDate(...)` cae en menos de 30 días. Por fila: concepto, cliente, fecha,
monto, y un botón **"Enviar recordatorio"** — server action que llama a la MISMA función
de envío que usa el cron (Parte D), no una nueva. Vive solo en la vista global: es
operación de toda la empresa, no del detalle de un cliente.

## Parte F — Agrupación por frecuencia (único / anual / mensual)

En `/cobros` y en la pestaña nueva de Finanzas del cliente (Parte G): secciones visuales
separadas — Pago único, Recurrente anual, Recurrente mensual — en vez de solo el filtro
de pills que ya existe (`frequencyFilter`, se conserva para buscar/filtrar dentro de una
sección). El modelo de datos ya distingue esto (`billingFrequencyEnum`,
`chargeFrequencyEnum`); es trabajo de vista, no de esquema.

## Parte G — Pestaña "Finanzas" en el workspace del cliente

`ClientWorkspace.tsx` tiene pestañas fijas por ADR-0035 (Resumen/Cotizaciones/Proyectos/
Comercial/Documentos/Portal). Se agrega una 7ma: **Finanzas** — extiende esa ADR (se deja
constancia aquí en vez de editarla, ADRs no se editan). Muestra los `billingItems` +
`recurringCharges` de ESE cliente, agrupados igual que la Parte F. Sin la card de
"Próximos a vencer" (esa es vista global, no de cliente).

## Fuera de alcance (a propósito)

- No se toca `recordPayment` ni `RecordPaymentDialog` (ADR-0057).
- No se agregan frecuencias nuevas a `recurringCharges` (sigue siendo solo
  `monthly`/`annual` — trimestral/semestral son de `billingItems` genéricos, no de este
  flujo).
- No se automatiza el cobro en sí (nadie carga una tarjeta ni cobra solo): el sistema
  deja el `billing_item` listo para que una persona registre el pago, igual que hoy.
- Proyectos creados así no reciben `domain`/`tech`/`accounts` — se llenan a mano, como
  cualquier proyecto manual hoy.

## Testing

- `sales/provision.test.ts` — función pura que decide qué crear (nombre, budget, annual,
  fechas de arranque) a partir de una Venta + sus cobros, sin tocar `db` — mismo patrón
  que `sales/model.test.ts` / `quotes/terms.test.ts`.
- `next-charge-date` — ya tiene tests; se agregan casos para los checkpoints (30/15/2/1
  días) y el reseteo de `reminderCheckpointsSent` al cambiar de ciclo.
- Integración: un test de la transacción completa (`provisionProjectAndRecurrents`)
  contra una base de prueba — crea Venta con un cobro único + uno anual + uno mensual,
  confirma proyecto creado una sola vez aunque se llame dos veces (idempotencia por
  `sales.projectId`).
- Cron de recurrentes: test que corre `getNextChargeDate` + materialización contra
  fechas fijas (no el reloj real), confirmando que el índice único evita duplicar el
  `billing_item` si corre dos veces el mismo día.
