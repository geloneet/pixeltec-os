# SEO & Contenido — analítica y atribución de contenido (Fase 1)

**Fecha:** 2026-09-03 · **WO:** WO-2026-00214 · **Aprobado por:** Miguel (CEO) — versión
revisada por Fable sobre el repo real · **Estado:** diseño aprobado, Bloque A implementado

## Contexto

Hoy PixelTEC publica contenido (blog + 26 landings de keyword, WO-2026-00189) y recibe
leads (`contact_form`, `newsletter`, `diagnostic`), pero **no existe ninguna línea que
una las dos cosas**. La única métrica de contenido que hay es un contador de visitas por
artículo (`blog_post_view_counts`, beacon `/api/blog/view`, GO 2026-08-04) que el propio
código declara "orientativa: bots que ejecutan JS pueden inflarla; la métrica seria es
GSC" — y GSC no está conectado. Cuando entra un lead, nadie sabe qué artículo o landing
lo trajo, ni si el contenido que se escribe sirve para algo.

Este documento define el módulo **SEO & Contenido**: de dónde salen los datos, cómo se
guardan, cómo se atribuye un lead a un contenido y qué se muestra. Es deliberadamente
más pequeño que el plan original de Miguel: sólo lo que se puede construir **hoy, sin
credenciales externas y sin inventar datos**.

### Qué NO entra en Fase 1 (decisión explícita)

- **GA4** — fuera de alcance por decisión de Miguel, aparte de este WO. No se instala,
  no se declara, no se prepara. Si algún día entra, entra por su propia decisión.
- **Dashboard conectado a datos reales de GSC** — la Fase 1 crea el esquema, el canal de
  egress y el cron, pero hasta que Miguel cargue `GOOGLE_SERVICE_ACCOUNT_JSON` la UI
  muestra un estado vacío explícito, nunca un número inventado.
- **Reglas automáticas corriendo** — las 4 reglas se escriben como funciones puras con
  tests (para poder validarlas hoy), pero **no** se conectan a ningún cron. Eso es Fase 3.
- **IA** (sugerencias de contenido, reescritura automática) — Fase posterior.
- Eventos `calculator_*` y `download_resource`: no existe superficie en el sitio que los
  emita. Registrarlos en el catálogo sería documentar algo que nunca ocurre.

## Modelo de datos (migración 0051)

Cuatro tablas nuevas y siete columnas aditivas en `leads`. Todo idempotente
(`IF NOT EXISTS`, constraints en bloques `DO $$ … EXCEPTION`), mismo estilo que 0044-0050.

### `content_events` — comportamiento first-party, sin PII

Un registro por hito de comportamiento observado en el sitio público.

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `site_id` | text | default `'pixeltec.mx'`; el módulo administra un solo sitio (misma decisión que `app_settings`, 0044) — multi-sitio cabe sin otra migración |
| `session_id` | text | uuid v4 generado en el CLIENTE y guardado en `sessionStorage`. No es un identificador de persona: muere al cerrar la pestaña y nunca se cruza con el correo |
| `path` | text | `/blog/<slug>` o `/<slug-de-landing>`. **Sin query string**: un `?utm_…` ajeno o un `?token=` pegado por error no debe quedar guardado |
| `post_id` | uuid NULL | FK → `blog_posts(id)` `ON DELETE SET NULL`; se resuelve en el servidor sólo si el path es `/blog/<slug>` y el post está `published` |
| `event` | text | del catálogo de abajo |
| `meta` | jsonb | acotado por tipo de evento (ver catálogo); default `'{}'` |
| `ip_hash` | text NULL | `hashIp()` de `@/lib/privacy` — **nunca** la IP cruda. Sólo para abuso/rate-limit |
| `created_at` | timestamptz | `now()` |

Índices: `(path, created_at)`, `(event, created_at)`, `(session_id)`.

**Dedupe de hitos** — único parcial sobre
`(session_id, path, event, coalesce(meta->>'depth',''))`. Es la garantía *real* de que
un scroll de 75 % no cuenta cinco veces porque el visitante subió y bajó: la base lo
impide, no "el cliente promete no reenviarlo". Se aplica sólo a los eventos de hito
(`scroll`, `view`, `cta_click`…) que es donde el duplicado es ruido; el índice es
parcial para no bloquear eventos que legítimamente se repiten.

### `gsc_page_daily` / `gsc_query_daily` — snapshots de Search Console

`gsc_page_daily(site_id, date, page, clicks, impressions, ctr, position, fetched_at)`
con `PK(site_id, date, page)`; `gsc_query_daily` añade `query` a la PK. Son **snapshots
diarios**, no un agregado: Search Console reescribe los últimos días, así que guardar el
día crudo permite re-traer y hacer upsert sin perder historia. `ctr`/`position` van como
`real` porque eso es lo que devuelve la API — no se redondean al guardar.

### `seo_sync_runs` — bitácora de cada corrida del cron

`(id, site_id, source, window_start, window_end, status, rows, error, started_at,
finished_at)`. Sin esto, un backfill de 16 meses que falla a la mitad es invisible.
`error` guarda un código estable, nunca el cuerpo de la respuesta de Google.

### `leads` — columnas aditivas

```
session_id          text          -- une el lead con su rastro en content_events
attribution         jsonb NOT NULL DEFAULT '{}'   -- {first:{…}, last:{…}}
landing_path        text          -- primera página del sitio en la sesión
first_content_path  text          -- primer /blog/* o landing visto
service_interest    text          -- qué servicio pidió (llenado a mano o derivado)
qualified_at        timestamptz   -- lo pone la UI al pasar a 'qualified'
converted_at        timestamptz   -- DERIVADO de la primera venta del cliente vinculado
client_id           uuid          -- FK → clients(id) ON DELETE SET NULL
```

**`revenue` NO se duplica en `leads`.** El dinero ya tiene dueño: `sales` (WO-2026-00106,
ADR-0057). Copiarlo aquí crearía dos verdades que se desincronizan en el primer pago
parcial. El ingreso atribuible a un contenido se deriva por
`lead.client_id → sales.client_id → cobros reales`. Por el mismo motivo `converted_at`
no se escribe a mano: sale de la primera venta del cliente vinculado.

## Catálogo de eventos

| Evento | Origen | `meta` | Nota |
|---|---|---|---|
| `view` | cliente | — | **Reusa** `ViewBeacon` y `/api/blog/view`, que siguen exactamente igual (contador agregado). El tracker además inserta el `view` en `content_events` — dos usos distintos del mismo hecho, ninguno reemplaza al otro |
| `scroll` | cliente | `{depth: 25\|50\|75\|90}` | Un registro por hito alcanzado; dedupe por el índice único parcial |
| `cta_click` | cliente | `{cta, position}` | Delegación de eventos sobre `[data-cta]` — no hay un handler por botón |
| `diagnostic_start` | cliente | `{variant}` | |
| `diagnostic_complete` | servidor | `{lead_id}` | |
| `lead_created` | servidor | `{lead_id, source}` | |
| `newsletter_signup` | servidor | — | |

Valores de `cta`: `diagnostico`, `contacto`, `whatsapp`, `internal_link`, `related`.
Valores de `position`: vocabulario cerrado (`header`, `footer`, `article_footer`,
`article_body`, `landing_cta`, `landing_related`, `sidebar`) — el catálogo está en
`src/lib/analytics/events.ts` y el endpoint valida contra él. Cerrado a propósito:
`article_footer` y `articleFooter` contando por separado es un dato roto que nadie nota.

### Estado real de cada evento en Fase 1

| Evento | ¿Se emite hoy? |
|---|---|
| `view`, `scroll`, `cta_click` | **Sí** — `ContentTracker` en el blog y en las landings |
| `diagnostic_start` | **No.** El wizard vive en `/diagnostico`, que no es una pieza de contenido: el endpoint sólo acepta paths del catálogo de contenido, así que el evento se descartaría. El emisor (`trackContentEvent`) queda listo; conectarlo exige decidir antes **qué significa** medir ahí, y eso es diseño de producto, no de infraestructura |
| `diagnostic_complete`, `lead_created`, `newsletter_signup` | **No.** Son eventos de servidor y en Fase 1 serían redundantes: el paso "leads" del embudo se calcula desde la tabla `leads` (que ya guarda `first_content_path`), no desde `content_events`. Escribirlos ahora crearía una segunda cuenta de leads que se puede desviar de la primera |

El catálogo los declara igualmente porque el esquema y la validación tienen que
soportarlos el día que se conecten. Lo que NO se hizo fue fingir que ya funcionan.

### Por qué el marcado de CTAs es sólo `data-*`

Los CTAs existentes (`blog-post-client.tsx`, `header.tsx`, `footer-section.tsx`,
`keyword-landing-page.tsx`) reciben **únicamente** atributos `data-cta` / `data-cta-pos`.
Cero cambio de clases, cero cambio visual, cero handler nuevo por botón. Un atributo de
datos es invisible para el usuario y para el diff de diseño; un `onClick` en cada CTA
sería una modificación de comportamiento repartida por medio sitio.

## Atribución

### Cookie `pt_attr` — first-party, 90 días, `SameSite=Lax`

```
{ first: {path, ref_host, utm_source, utm_medium, utm_campaign, ts},
  last:  {…mismo shape…},
  first_content_path }
```

Reglas duras:

1. **El first-touch es inmutable.** Una vez escrito, no se toca nunca. Si se reescribiera
   en cada visita, "primer contacto" acabaría significando "última visita" y toda la
   atribución sería una mentira estadística.
2. **`ref_host` es sólo el host** del referrer, nunca la URL completa: la ruta de un
   referrer externo puede llevar datos de esa otra página que no nos corresponden.
3. **De los UTM se guardan sólo `source`/`medium`/`campaign`.** No se guarda el query
   string completo: es el vector por el que un `?email=` o un `?token=` ajeno acabaría
   persistido.
4. Sin PII, sin IP, sin contenido de formularios.

### Lado servidor

`submitContactForm` y `submitDiagnostic` leen la cookie `pt_attr` con `cookies()` y el
`session_id` que el formulario manda como campo oculto (`<SessionIdField />`), y persisten
`attribution`, `landing_path`, `first_content_path` y `session_id` en el lead. La lectura
es **best-effort**: una cookie corrupta o ausente no puede costar un lead — se guarda el
lead sin atribución y ya. El `session_id` se valida contra el formato uuid v4 antes de
persistirse: llega del cliente y no entra sin comprobar.

Superficies cubiertas: la página `/contact`, la sección de contacto de la home, el
formulario de la landing de PixelBot y el wizard del diagnóstico.

### El newsletter queda fuera — y por qué

El plan pedía atribuir también el alta al newsletter. **No se puede sin cambiar el
modelo**, y verificándolo en el código real: `subscribeToNewsletterAction` NO crea una
fila en `leads` — escribe en `newsletter_subscribers`, que no tiene ninguna columna de
atribución, y la migración 0051 no le añade ninguna (el plan aprobado sólo toca `leads`).
El valor `newsletter` del enum `lead_source` existe, pero hoy nadie lo escribe.

Hay dos salidas y ninguna es de Fase 1: crear un `lead` por cada alta al newsletter
(cambio de comportamiento del funnel, con riesgo de duplicar contra el lead de contacto
de la misma persona), o añadir columnas de atribución a `newsletter_subscribers` (otra
migración). **Miguel decide** cuál, si es que alguna. Mientras tanto el newsletter sigue
funcionando exactamente igual que hoy, sin atribución.

## "Función" de un contenido — `awareness | consideration | commercial`

No es un campo nuevo que alguien tenga que llenar: se **deriva** de `post.seo.searchIntent`,
que ya existe en el jsonb de `blog_posts` y ya se captura en el editor.

| `searchIntent` | Función |
|---|---|
| `informational` | `awareness` |
| `commercial-investigation` | `consideration` |
| `transactional` | `commercial` |
| `navigational` | `awareness` (marca; no compite por demanda nueva) |
| `''` (sin declarar) | `awareness` — el default conservador: un contenido sin intención declarada no se presume comercial |

Override opcional `seo.contentRole` para el caso raro en que la intención de búsqueda y
la función en el embudo no coinciden. `blog_posts.seo` es jsonb, así que **no hace falta
migración** para el override.

Las landings de keyword no tienen `searchIntent`: se clasifican por su `ctaHref`
(`/diagnostico` → `consideration`, `/contact` → `commercial`).

## Embudo por contenido

`funnel.ts` recibe `{gscPage, events, leads}` de un path y devuelve las filas:

```
impresiones → clicks → visitas → 75 % de lectura → CTA → lead → calificado
```

con el % de caída en cada paso. Es una función pura: las dos primeras filas quedan en
`null` (no en `0`) mientras GSC no esté conectado, y la UI muestra "Search Console aún no
conectado". **Un cero y un "no lo sé" no son lo mismo**, y confundirlos es exactamente
cómo un dashboard empieza a mentir.

## Ventanas de comparación

28 días vs. los 28 anteriores (`WINDOW_DAYS` en la config del módulo). 28 y no 30 porque
alinea los días de la semana: comparar cuatro semanas completas contra cuatro semanas
completas evita que un mes con cinco lunes parezca crecimiento.

## Reglas (escritas hoy, conectadas en Fase 3)

Cuatro funciones puras con pisos configurables (mínimo de impresiones, mínimo de visitas)
para que no disparen sobre ruido estadístico:

1. **Actualizar** — posición 5-20 con impresiones por encima del piso: hay demanda y el
   contenido no la captura.
2. **Mejorar CTR** — posición ≤ 5 pero CTR bajo para esa posición: el título/description
   no está haciendo su trabajo.
3. **Revisar CTA** — tráfico y lectura profunda sanos, cero clicks de CTA: el contenido
   funciona y la conversión no.
4. **Contenido muerto** — sin impresiones ni visitas en toda la ventana.

Ninguna corre en un cron todavía. Se escriben ahora porque son testeables con fixtures
**sin datos reales**, y porque escribirlas obliga a que el modelo de datos las soporte.

## Canal de egress `google`

Search Console entra por el contrato E0 como un canal más (`EGRESS_GOOGLE_MODE`,
operación `read`), con el mismo molde que `unsplash-egress.ts`: `assertEgressAllowed`
primero, error explícito `gsc_not_configured` si falta la credencial, y **nunca** se
propaga el cuerpo crudo de la respuesta del proveedor. Autenticación por JWT de cuenta de
servicio con `google-auth-library` — **no** el paquete `googleapis` completo, que arrastra
cientos de APIs que no se usan.

Canal `optional: true` en el validador de predeploy: ausente = `disabled` = fail-closed,
que es el estado correcto hasta que Miguel cargue la credencial.

## Cron `GET /api/cron/seo-gsc-sync`

Mismo esqueleto que `recurring-charges`: `CRON_SECRET` → `assertCronExecutionAllowed()` →
trabajo. Dos modos, decididos por el estado de la tabla, no por un flag:

- **Sin filas para el sitio** → backfill de 16 meses, día por día (`dimensions: ['page']`
  y `['page','query']`, `rowLimit: 25000`, paginación por `startRow`, con throttle entre
  llamadas).
- **Con filas** → re-trae los últimos 5 días y hace upsert. Search Console tiene 2-3 días
  de retraso y reescribe datos ya publicados; re-traer 5 días cubre el retraso con margen.

Cada corrida se registra en `seo_sync_runs`. El test mockea `fetch`: **nunca** se llama a
Google de verdad desde un test.

## Decisiones abiertas — Miguel decide

1. **GA4** — hoy fuera de alcance por decisión suya. ¿Se queda fuera de forma permanente
   (el tracking first-party de `content_events` cubre lo que se necesita), o entra en una
   fase posterior? Si entra, cambia el aviso de privacidad otra vez.
2. **UI de leads** — la Fase 1 entrega lo mínimo (cambiar estado, vincular a cliente).
   ¿Debe crecer a una bandeja de trabajo completa (asignación, notas, seguimiento), o los
   leads se trabajan en `/clientes` una vez convertidos y esta vista sólo triage?
3. **Aviso de privacidad** — el borrador de este WO añade a Meta Platforms (el Pixel lleva
   en producción desde antes y **no aparecía** en el aviso — es una omisión que ya existe
   hoy, no la introduce este WO) y describe la cookie `pt_attr`. **Requiere revisión legal
   antes de publicarse.** ¿Lo revisa su asesoría, o se publica como está asumiendo el
   riesgo?
4. **Retención de `content_events`** — la tabla crece sin techo. ¿Se purga a los 12/24
   meses, o se agrega a un rollup diario y se borra el detalle? No se decidió en Fase 1
   porque con cero filas no hay urgencia, pero hay que decidirlo antes de que la haya.

## Testing

- `events.test.ts` — el catálogo y sus schemas Zod: `meta` fuera de forma se rechaza.
- `attribution.test.ts` — funciones puras: first-touch inmutable, `ref_host` sin ruta,
  UTM recortados, cookie corrupta → `null` sin lanzar.
- `api/events/route.test.ts` — mismo patrón que `api/blog/view/route.test.ts`: validación
  estricta, `post_id` sólo para posts publicados, fail-silent ante caída de DB.
- `brand-filter` / `period` / `classify` / `funnel` / `rules` — funciones puras con
  fixtures, sin `db` y sin reloj real.
- `gsc-sync.test.ts` — `fetch` mockeado; se verifica que backfill y ventana incremental
  eligen el rango correcto y que la corrida queda registrada.
- Integridad de navegación y registro de módulos: los tests existentes
  (`nav-integrity.test.ts`, `registry.test.ts`) ya cubren la ruta nueva porque derivan del
  registro — si `/seo/contenido` se registra mal, fallan solos.
