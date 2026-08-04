# Plan — Rediseño minimalista del Blog Admin

**Fecha:** 2026-08-04 · **Rama:** `feat/blog-admin-minimal-redesign` (base `d0a9571`) · **Sin deploy.**

## Diagnóstico confirmado en código (`src/app/(admin)/blog-admin/page.tsx` @ d0a9571)

1. Tres tarjetas KPI grandes (líneas 132-145) para métricas no accionables. ✔
2. Layout 70/30 Posts/Briefs en columnas simultáneas (148-249). ✔
3. Títulos truncados a 60 chars (posts) y 40 (briefs), una línea. ✔
4. Acción única «Editar» en toda fila, sin relación con el estado. ✔
5. Briefs `generated` muestran «Ver borrador» → duplica la entrada del post. ✔
6. Sin búsqueda, sin filtros, sin orden. ✔
7. Columna «Fecha» = `createdAt` sin etiqueta y **sin TZ editorial** (mismo bug
   «3 vs 4 de agosto» ya corregido en el lado público — aquí seguía vivo). ✔
8. La pantalla es un reporte, no una herramienta: nada dice «qué sigue». ✔

## IN / OUT

**IN:** página principal (header compacto, resumen en línea, tabs Posts/Briefs,
toolbar búsqueda+estado+orden, listas ancho completo, acción contextual por
estado, menú ⋯ con acciones reales, franja de atención, empty states,
responsive 390/768/1440, a11y, tests de lógica).
**OUT:** editor, formulario de brief, generación IA (solo se REUSA
`startDraftGeneration`/`getBriefGenerationStatus`), publicación, schema,
estados nuevos, analytics, deploy, write-back NeuroPIXEL.

## Wireframe textual

```
Blog                                          [+ Nuevo brief]
Gestiona ideas, borradores y publicaciones.

6 posts · 3 publicados · 3 borradores · 0 por revisar

⚠ 2 contenidos necesitan atención            [Ver pendientes]   ← solo si >0

[ Posts 6 ] [ Briefs 7 ]
[ Buscar por título… ] [ Estado: Todos ▾ ] [ Más recientes ▾ ]
──────────────────────────────────────────────────────────────
Borrador · Bot de WhatsApp para PyMEs (hasta 2 líneas)
1,880 palabras · 8 min · Actualizado 3 ago 2026   [Continuar] [⋯]
──────────────────────────────────────────────────────────────
Publicado · Agente de IA en WhatsApp…
1,887 palabras · 8 min · Publicado 3 ago 2026  [Ver artículo] [⋯]
```

## Componentes (mínimos)

- `page.tsx` — Server Component: mismas queries (`listAllPosts`, `listBriefs`),
  header, banner de error, resumen; pasa datos serializados al workspace.
- `blog-admin-logic.ts` — funciones PURAS testeables: etiquetas/clases de
  estado con degradación segura ante estados desconocidos, `postNextAction`,
  `briefNextAction`, `filterPosts`/`filterBriefs` (búsqueda+estado+orden),
  `editorialSummary`, `attentionCount`, `postDateInfo` (etiqueta
  Publicado/Actualizado/Creado + `formatEditorialDate` TZ México).
- `blog-admin-workspace.tsx` — ÚNICO Client Component: tabs accesibles,
  toolbar, listas, menú ⋯ (shadcn DropdownMenu), generación de brief
  (reusa acciones Fase B con polling 5s tope 5 min), archivado con
  confirmación en dos pasos, empty states.

## Data flow

Servidor: `listAllPosts()` + `listBriefs()` → props serializadas → filtrado/
orden/búsqueda 100% en cliente (≤ decenas de filas; no se construye
infraestructura de búsqueda). Cero queries nuevas, cero contratos tocados.

## Acciones contextuales (solo operaciones reales)

Posts: draft→**Continuar** (editor) · needs-review→**Revisar** (editor) ·
approved→**Publicar** (editor: ahí vive el botón real con el gate) ·
published→**Ver artículo** (público, nueva pestaña) · archived→**Ver** (editor).
Menú ⋯: Editar · Ver en el sitio (solo published) · Archivar (dos pasos,
`archivePost` existente; oculto si ya archived).
Briefs: pending→**Generar borrador** (`startDraftGeneration`+poll→redirect) ·
generating→**Generando…** deshabilitado con `aria-disabled` y poll ·
generated→**Abrir borrador** · discarded→sin acción (no existe vista de brief).

## Estados vacíos

Sin resultados de filtros / sin posts / sin briefs — texto + siguiente acción,
sin ilustraciones.

## Responsive

Desktop: fila en grid ancho completo. Móvil (<md): cada fila colapsa a bloque
(estado arriba, título 2 líneas, meta, acciones), targets ≥44 px, sin overflow
horizontal, toolbar apilada.

## A11y

Tabs con `role=tablist/tab/tabpanel` + flechas, `aria-selected`; labels en
inputs; estados con texto (no solo color); DropdownMenu shadcn (Escape/focus
return integrados); `aria-live=polite` para el contador de resultados;
contraste AA con tokens existentes.

## Pruebas

`blog-admin-logic.test.ts`: mapeo de acción por CADA estado real + degradación
de estado desconocido, búsqueda (con/sin resultados), filtro por cada estado,
orden reciente/antiguo, resumen con conteos correctos, attention count, fecha
etiquetada correcta por prioridad publicado>actualizado>creado. Suite completa
+ typecheck + build + egress + `git diff --check`.

## Riesgos y rollback

Riesgo: regresión visual en flujos editar/crear (mitigado: rutas y acciones
intactas, solo cambia la página índice). Rollback: revertir el merge de la
rama; la página anterior queda en el historial. Cero migraciones, cero datos.

## Commits previstos

1. `docs(blog): plan del rediseño minimalista del admin`
2. `feat(blog): rediseño minimalista del blog admin — tabs, toolbar y acciones contextuales`
3. `test(blog): lógica editorial del admin (acciones, filtros, fechas)`

## Limitación declarada

Screenshots autenticados no disponibles desde esta sesión (no se manejan
credenciales); evidencia = código + tests + revisión de Miguel en su navegador
sobre el Draft PR.
