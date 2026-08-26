# WO-2026-00088 · FASE 11 — Auditoría de paridad Encino → PixelTEC OS y causa del defecto

**Fecha:** 2026-08-26 · **Departamento:** Ingeniería · **Rama:** `feature/dashboard-cleanup-blog` (worktree `wt-dashboard-cleanup`)
**Origen:** Miguel reporta que «no se ven los snippets al lado de SEO al agregar una nueva entrada».
**Referencia auditada:** `~/Projects/pixeltec-muebles-encino` @ `71ad0d0` (rama `feature/migracion-seo-y-diseno`), **solo lectura**.

---

## 1. El defecto

El editor de entradas de Encino (`src/components/admin/blog-editor.tsx`) tiene un inspector de **4 pestañas**:
`Publicar · Contenido · SEO · Snippets`.

El de PixelTEC OS (`src/components/blog/cms/editor.tsx`) se entregó con **3**: la pestaña **Snippets** —
la tarjeta «Rich snippets»— no se portó. Es exactamente lo que Miguel no encontraba al lado de SEO.

## 2. Auditoría completa del módulo Blog

Capacidad por capacidad, contra Encino. `✓` = presente antes de esta fase.

| Capacidad de Encino | PixelTEC OS | Nota |
|---|---|---|
| Lista de entradas + píldoras de estado | ✓ | |
| Filtros: búsqueda, categoría, fecha | ✓ | mismos tres controles |
| Nueva entrada / eliminar / archivar | ✓ | |
| Programar publicación | ✓ | `ScheduleDialog` |
| Categorías (alta, edición, borrado) | ✓ | `/blog-cms/categorias` |
| Editor de cuerpo (13 acciones de formato) | ✓ | sobre el Tiptap ya existente, en Markdown |
| Subida de imagen del cuerpo | ✓ | a R2, con magic bytes |
| Portada + texto alternativo | ✓ | |
| Autosave 2.5 s / borrador / publicar | ✓ | |
| Historial de versiones | ✓ | |
| Categoría · Etiquetas | ✓ | |
| Preguntas y respuestas (FAQ) + FAQ con IA | ✓ | |
| Ubicación (Google Maps) | ✓ | con la excepción CSP mínima SC-2 |
| Vista previa del resultado en Google (SERP) | ✓ | |
| Title tag · meta description · slug | ✓ | con contadores 70/160 |
| `noindex` · `nofollow` por entrada | ✓ | |
| Generar / regenerar artículo con IA | ✓ | |
| **Pestaña «Snippets» (Rich snippets)** | **✗ → corregido en FASE 11** | **§3 y §4** |
| Biblioteca de medios (`MediaPicker`) | ✗ | PixelTEC OS no tiene módulo Media; sube directo a R2. **Dependencia real** — Miguel decide si quiere el módulo |
| Edición de imágenes con IA (`AiEditDialog`, Gemini «Nano Banana») | ✗ | Requiere proveedor Gemini + biblioteca de medios. **Dependencia real** — Miguel decide |

Fuera del Blog, el admin de Encino tiene módulos que PixelTEC OS no replica y que **nunca estuvieron en el
alcance de este WO**: `seo/*` (SEO Control Center: llms, local-business, redes, robots, salud, schema,
sitemap, structured-data), `media`, `paginas` + `menus`, `editor-paginas`, `editor`, `configuracion`
(mantenimiento, roles). Se listan aquí para que la ausencia sea visible y decidible, no para portarlos.

## 3. Causa raíz

Al portar la pestaña «Snippets» se encontró que Encino **no guarda los tipos en la entrada**: los escribe en
un ajuste global del SEO Control Center (`seo_page_schema`, un mapa `ruta → tipos[]`, ver
`src/app/actions/seo-schema.ts:115`). PixelTEC OS no tiene ese módulo.

De ahí se concluyó «dependencia ausente ⇒ no portable», se omitió la capacidad y se registró **como
documentación en dos sitios**:

- `docs/pr/WO-2026-00088-blog-matriz.md` línea 103 — dentro de un párrafo sobre el editor, redactado como
  hecho consumado: *«no portada, documentada como no implementada por dependencia ausente»*.
- El comentario de cabecera de `src/components/blog/cms/editor.tsx` — la misma frase.

**Los dos fallos que se sumaron:**

1. **La premisa técnica era falsa.** La dependencia era del **lugar de guardado**, no de una capacidad.
   `blog_posts.seo` es `jsonb` y ya tenía precedente explícito de campos aditivos **sin migración**
   (`coverAttribution` en B-PR5, `nofollow` en este mismo WO). Además, **la mitad de la tarjeta no dependía
   de nada**: la lista de solo lectura de lo que la entrada ya emite (BlogPosting, BreadcrumbList, FAQ) es
   información que PixelTEC OS ya publicaba.
2. **La omisión no se escaló como decisión.** En este WO sí se escalaron D-C (modelo de datos) y D-C-bis
   (wizard de IA) y ambas las aprobó Miguel. Esta no. Recortar una capacidad del alcance es una decisión de
   Miguel, y se resolvió sola dentro de la tarea.

**Por qué la verificación no lo atrapó.** `verify-scope` comprueba *qué archivos cambiaron*; los 91 tests
comprueban *lo que se construyó*. Ninguno de los dos puede ver una capacidad que **nunca se escribió**. El
único control capaz de detectarlo era la matriz de paridad — y la firmó el mismo agente que decidió la
omisión, redactada como afirmación en vez de como pregunta abierta. Un control auto-certificado no es un
control.

## 4. La corrección

| Archivo | Cambio |
|---|---|
| `src/lib/blog-cms/schema-types.ts` *(nuevo)* | Catálogo `BLOG_SCHEMA_TYPES` (copia literal del de Encino), `sanitizeBlogSchemaTypes` (saneado defensivo, tope de 10), `selectableBlogSchemaTypes` (excluye lo que ya se emite solo) y `buildExtraSchemaNodes`. Módulo puro. |
| `src/lib/blog/types.ts` | `seo.schemaTypes?: string[]` — campo aditivo del jsonb, **sin migración**. |
| `src/lib/blog-cms/schemas.ts` | Validación en frontera: `schemaTypes` máx. 10 · 60 caracteres. |
| `src/lib/blog-cms/actions.ts` | Persiste los tipos saneados en el guardado normal de la entrada. |
| `src/components/blog/cms/editor.tsx` | 4.ª pestaña «Snippets» + tarjeta «Rich snippets»: lista de lo automático (con FAQ condicional, igual que Encino) y selector de tipos adicionales con chips. |
| `src/app/blog/[slug]/page.tsx` | Emite un nodo JSON-LD mínimo por tipo — **server-side**, donde Encino lo inyecta desde el cliente. |
| `docs/pr/WO-2026-00088-blog-matriz.md` | Línea 103 corregida: la afirmación falsa queda tachada y explicada, no borrada. |

**Diferencias deliberadas con Encino** (mejoras, no desviaciones):
- Los tipos viven **en la entrada**, no en un ajuste global — se copian, exportan y borran con ella.
- Se guardan con el **guardado normal** (autosave / borrador / publicar); Encino necesita un botón
  «Guardar snippets» aparte porque escribe en otro almacén.
- El JSON-LD se resuelve **en el servidor**, así que Google lo ve sin ejecutar JavaScript.

## 5. Evidencia

- `npx vitest run src/lib/blog-cms/schema-types.test.ts` → **PASS (10) FAIL (0)**
- `npx vitest run src/lib/blog-cms src/lib/blog src/components/blog` → **PASS (218) FAIL (0)**
- `npx tsc --noEmit` → 1 error, **preexistente y ajeno**: `.next/types/app/api/pixelforge/runs/route.ts`
  (tipo generado obsoleto, ya en Pendientes). Cero errores en el código de esta fase.
- `npx eslint` sobre los 4 archivos tocados → **No issues found**
- Extremo a extremo en la BD dev `:5437`: fijando `seo.schemaTypes = ["Product","Event"]` en la entrada
  publicada, `GET /blog/como-elegir-el-stack-correcto-para-tu-pyme-en-2026-4` devuelve `"@type":"Product"` y
  `"@type":"Event"` en el HTML, junto a los `BlogPosting` / `BreadcrumbList` / `FAQPage` que ya emitía.

## 6. Propuesta de regla (requiere aprobación de Miguel — ADR-0049)

> **ING-004 [Propuesta]** — En toda tarea declarada como «paridad» con un sistema existente, la matriz de
> paridad debe listar **cada** capacidad del origen en una fila con veredicto explícito `portada` /
> `no portada`. Ninguna fila `no portada` puede cerrarse dentro de la tarea: es un gate **«Miguel decide»**
> antes de dar la fase por terminada. La justificación de una omisión debe nombrar el **mecanismo concreto**
> que falta y qué se intentó, nunca una etiqueta de módulo — «depende de X, que no existe aquí» no es una
> causa verificada mientras no se descarte guardar el dato donde ya se guardan los demás.
>
> **Por qué:** WO-2026-00088 FASE 8. Una capacidad (pestaña «Snippets») se recortó del alcance con una
> premisa técnica falsa, se registró como nota documental en vez de como decisión, y sobrevivió a
> verify-scope y a 91 tests porque ninguno de los dos puede ver lo que no se escribió. Lo detectó Miguel
> usando el producto.
