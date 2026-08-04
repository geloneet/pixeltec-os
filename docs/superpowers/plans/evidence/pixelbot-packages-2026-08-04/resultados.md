# Evidencia de validación — PixelBot paquetes comerciales + identidad de marca (2026-08-04)

## 1. `npm ci`
OK — 1035 paquetes instalados, sin errores (solo warnings de deprecación preexistentes del repo).

## 2. `npx tsc --noEmit`
`TypeScript: No errors found` — cero errores nuevos.

## 3. `npx vitest run src/components/pixelbot-landing/pixelbot-landing.test.ts`
`PASS (32) FAIL (0)` — todo verde, incluye los 15 casos del test matrix del plan
(4 planes exactos, 4 precios autorizados y ningún otro `$`, badge solo en
Crecimiento, identidad mencionada en los 4 planes, nota común con IVA/12
meses/Meta, FORBIDDEN extendido, lenguaje condicional en Negocio/A Medida,
FAQ.items = 16 con la pregunta de identidad + caveat de Meta, `buildPixelbotMessage`
serializa/ignora plan y nombre del bot, labels accesibles del select/input
nuevos, contrato del formulario intacto, ejemplos de nombre etiquetados como
ilustrativos).

## 4. `npx vitest run` (suite completa)
`PASS (2258) FAIL (15) skipped (1)` de 2274 tests totales, en 647 test suites
(639 passed / 8 failed).

Los 15 FAIL son preexistentes y NO relacionados con este incremento:
- `NewDefinitionForm.test.tsx` (3 fallas) — `TypeError: Cannot read properties
  of undefined (reading 'clear')` en el setup del test (localStorage mock).
- `NewPixelforgeForm.test.tsx` (12 fallas) — mismo `TypeError` de setup.

Ambos archivos pertenecen al módulo PixelForge, no tocado por este incremento.
El plan anticipaba un baseline de "2160 PASS / 15 FAIL preexistentes de
NewPixelforgeForm" — el conteo total de PASS subió (más tests en el árbol por
otros incrementos de esta sesión + los 23 tests netos nuevos que agregué en
`pixelbot-landing.test.ts`), pero el número y la identidad de los FAIL
preexistentes coincide exactamente. Cero regresiones nuevas.

## 5. `npm run build` (`next build`, producción local)
Exit code 0. `✓ Compiled successfully` + `✓ Generating static pages (106/106)`.
Incluye `ƒ /pixelbot 16.8 kB / 217 kB First Load JS`. Los logs de
`getPublishedCards failed` (blog) y `Dynamic server usage` (blog-admin) durante
la recolección de datos son ruido esperado por usar un `DATABASE_URL` dummy
local (ver sección 7) — no son errores de build, el build terminó en verde.

## 6. `npm run validate:egress`
`OK — contrato E0 válido (perfil dev)`.

## 7. Verificación visual (smoke local)

Se levantó `npm run dev` (puerto 9002) con un `.env.local` temporal de valores
dummy sintéticos (gitignored, creado y borrado dentro de esta sesión, igual
que en el incremento previo de esta misma landing) porque `RESEND_API_KEY` y
otras vars faltantes rompían la recolección de datos del build/dev en rutas
no relacionadas (`/api/notifications/charges`, NextAuth, `DATABASE_URL`).

Capturas guardadas en este mismo directorio:
- `792w-hero.jpg` — viewport ~792px (ver nota abajo): hero con el nuevo H1,
  trust row de 4 items, CTA "Ver planes" apuntando a `#planes`.
- `1440x900-hero.jpg` — desktop 1440×900: mismo hero.
- `1440x900-pricing.jpg` — desktop 1440×900: las 4 tarjetas de precio en una
  sola fila, "PixelBot Crecimiento" con el badge visible "Más elegido",
  precios `$1,490`, `$2,990`, `$5,990`, `Desde $8,490 MXN/mes + IVA`.

Confirmado además vía `curl` a `/pixelbot` (HTTP 200) y navegación real:
- Sección de identidad de marca ("Tu bot no tiene que llamarse PixelBot.")
  renderiza título, cuerpo, 4 chips de ejemplo (Dentista Bot, Mr. Smile Bot,
  Asistente Fluvial, Clínica Nova Bot) etiquetados como ilustrativos, y el
  caveat de Meta como texto visible (no tooltip).
- La tabla comparativa hace scroll horizontal dentro de su propio contenedor,
  sin overflow de página.
- Sin errores de consola atribuibles al código nuevo (los únicos errores de
  consola son de imágenes sin `src` y NextAuth mal configurado, ambos efectos
  esperados del `.env.local` dummy, no del código de este incremento).

### Riesgo residual — NO verificado
- **Viewport móvil real (<640px):** la herramienta de resize de ventana del
  navegador quedó anclada en ~792px de ancho lógico en esta sesión (falló al
  pedir 390×844 y también al pedir 300×700 sobre la misma pestaña; una
  pestaña nueva sí respetó 1440×900, pero no se logró un ancho angosto real
  antes de agotar el intento). Por lo tanto **no se confirmó visualmente**
  el layout de 1 columna (`grid-cols-1`) de las tarjetas de precio por debajo
  del breakpoint `sm` (640px) ni el wrap del hero en un teléfono real. La
  clase usada (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`) sigue el mismo
  patrón responsive ya probado en otros componentes del mismo archivo
  (`pixelbot-capabilities.tsx`, `pixelbot-comparison.tsx`), por lo que el
  riesgo se considera bajo pero no está cerrado con evidencia visual.
- **Viewports 768×1024 y 2560×1440:** no capturados (se priorizaron 1
  móvil + 1 desktop según el brief, dado el costo/tiempo).
- **Accesibilidad por teclado exhaustiva:** no se probó tab-order completo,
  solo se verificó por código que el `<select>` de plan y el `<input>` de
  nombre del bot tienen `<Label htmlFor>` (test automatizado) y que el FAQ
  usa el mismo `Accordion` Radix accesible ya existente.
- **`prefers-reduced-motion`:** no se re-verificó explícitamente en este
  incremento (los componentes nuevos, `pixelbot-client-branding.tsx` y
  `pixelbot-pricing.tsx`, son server components sin animación propia, por lo
  que no interactúan con `useReducedMotion`; los componentes con animación
  preexistente —hero, console showcase— no se tocaron).
