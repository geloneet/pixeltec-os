# WO-2026-00088 — Blog: matriz origen (Muebles Encino) → destino (PixelTEC OS)

`[Verificado en código]` Origen: `/Users/pixeltec/Projects/pixeltec-muebles-encino`, rama de **producción** `feature/migracion-seo-y-diseno` @ `71ad0d0` (working tree limpio = rama). `main` (`fb57dfc`) **no tiene blog**; `feature/seo-control-center`, `feature/admin-configuracion`, `worktree-media-library`, `worktree-menus-navigation-builder` llevan una versión anterior del mismo blog (sin `discardEmptyDraftAction`/`deleteBlogPostIfEmpty`, editor más viejo; migraciones 0008–0017 idénticas). Se porta desde producción.

Destino: PixelTEC OS `feature/dashboard-cleanup-blog` (base `f87d0e2`). Ruta admin decidida por el SG (D-A, SC-1): `src/app/(admin)/blog-cms/**` → `/blog-cms`, etiqueta «Blog».

**D-C — APROBADA por Miguel: Opción A (evolución aditiva).** **D-C-bis — APROBADA: wizard IA sobre el cliente Anthropic ya existente** (`src/lib/blog/ai/client.ts`, sin deps ni env nuevas). Ambas EJECUTADAS — ver §6.

Sin IDs, buckets, dominios, env ni credenciales de Encino: solo rutas de archivo y nombres.

---

## 1. Capacidades COMPROBADAS en Encino y su destino

| # | Capacidad | Origen (archivo:línea) | Modelo/tabla | Permiso en Encino | Equivalente hoy en PixelTEC OS | Adaptación en el port |
|---|---|---|---|---|---|---|
| 1 | Crear borrador (acción + redirect al editor; sin `/nuevo`) | `src/app/actions/blog.ts:92` `createBlogDraftAction`; `queries/blog.ts:274` `createBlogPostDraft`; `components/admin/new-post-button.tsx` (modal Manual / Con IA) | `blog_posts` (slug `borrador-xxxxxxxx`) | `requireResourceAction(blog,"create")` | `createManualPost` (`src/lib/blog/actions/posts.ts:87`) | acción nueva en `src/lib/blog-cms/actions.ts` con `requireUserSession` (crear) → redirect a `/blog-cms/[id]/editar` |
| 2 | Editar con autosave (2.5 s, sin revisión) y guardado explícito | `blog.ts:135` `saveBlogPostAction` (`intent: autosave\|draft\|publish\|schedule`, zod `saveSchema` :46-73); `blog-editor.tsx` `AUTOSAVE_DELAY_MS` | `blog_posts` | edit | `updatePost` (:131) sin autosave | `saveBlogPost({intent})` + autosave en el editor |
| 3 | Publicar / despublicar a borrador | `blog.ts:173-185` (status `published`, `publishedAt = existing ?? now`) | `status`, `published_at` | edit (publicar = edit en Encino) | `publishPost` exige `requireAdmin` (:338) | mantener `requireAdmin` para publicar (política de PixelTEC OS: IA sin revisión humana no publicable, PR #50) |
| 4 | Programar (`scheduled_at` futuro; barrido en render, throttle 60 s/proceso) | `blog.ts` `intent:"schedule"`; `queries/blog.ts:330` `publishDueScheduledPosts`; `schedule-post-dialog.tsx` | `scheduled_at` (mig 0017), status `scheduled` | edit | **no existe** | columna `scheduled_at` + estado `scheduled` + barrido en render de `/blog-cms`, `/blog`, `/blog/[slug]` (mismo patrón; sin cron nuevo) |
| 5 | Archivar / restaurar (a borrador) | `blog.ts:286,308`; `archive-blog-post-button.tsx` | status `archived` | edit | `archivePost`/`unarchivePost` (requireAdmin) | reutilizar |
| 6 | Eliminar (HARD, cascada de revisiones) | `blog.ts:329` `deleteBlogPostAction`; `queries:399` | — | `delete` | **no existe** (legacy nunca borra) | implementar con `requireAdmin` + confirmación; cascada sobre `blog_post_versions`/`blog_activity`/`post_redirects`/`blog_post_view_counts` (FKs ya `cascade`) |
| 7 | Revisiones (snapshot en cada guardado explícito; 10 en UI; restaurar conserva slug/status/fechas) | `blog.ts:355` `restoreBlogPostRevisionAction`; `queries:520-551`; `blog-editor.tsx` «Historial de versiones» | `blog_post_revisions` (mig 0013) | edit | `blog_post_versions` + `snapshotPost/listVersions/restoreVersion` (`src/lib/blog/versions.ts`) | reutilizar `blog_post_versions` (misma semántica; `reason` = `'manual'\|'publicacion'`) |
| 8 | Categorías (tabla; 1 nivel padre/hijo; slug; descripción; crear/eliminar; sin editar) | `blog/categorias/page.tsx`; `blog.ts:425` `createBlogCategoryAction`, `deleteBlogCategoryAction`; `queries:409-494`; `schema/blog-posts.ts:95-112`; mig 0008/0015 | `blog_categories` (name unique, slug, parent_id, description) | view/edit/delete | `category` = unión fija de 4 valores (`BlogCategory`, `src/lib/blog/types.ts`) | tabla `blog_categories` nueva (aditiva); `blog_posts.category` sigue siendo texto (Encino tampoco usa FK) |
| 9 | Etiquetas (coma-separadas; pills públicas; filtro `?etiqueta=`) | `blog-editor.tsx` «Etiquetas»; `(es)/blog/page.tsx` filtro | `tags text[]` (mig 0009) | edit | `tags text[]` ya existe (+ `tag-input.tsx`) | reutilizar columna; filtro público por query |
| 10 | Slug (slugify título hasta que el usuario lo toca; dedupe `-2…-50` en servidor) | `src/lib/blog-html.ts` `slugifyTitle`; `blog.ts:150-170` | `slug unique` | edit | `uniqueSlug` (`posts.ts:36`) + `post_redirects` 301 al cambiar slug | reutilizar `uniqueSlug`/`changeSlug` (superconjunto: conserva redirects) |
| 11 | Portada + alt | `blog-editor.tsx` «Imagen destacada»; `save-upload.ts` (filesystem local, sharp→webp, 15 MB, jpeg/png/webp/gif/avif); mig 0012 | `cover_image`, `cover_image_alt` | edit | `POST /api/blog/cover` a **R2** (jpeg/png/webp, 5 MB, magic bytes, `requireAdmin`) | reutilizar la ruta R2 existente (adaptación obligatoria (9)); añadir `cover_image_alt` (hoy `seo.ogImageAlt` cumple el mismo papel → **reutilizar `seo.ogImageAlt`**, sin columna nueva) |
| 12 | Editor enriquecido (contentEditable + execCommand, 13 botones: H2/H3/¶/B/I/listas/alineación/código/enlace/imagen; imágenes redimensionables; panel de enlace) | `blog-editor.tsx:988-1235` | `content` HTML saneado (`sanitizeBlogHtml`, allowlist de 20 tags) | edit | Tiptap (`src/components/blog/rich-markdown-editor.tsx`, `tiptap-extensions.ts`) + markdown (`body`) | **decisión D-C**: (a) editor HTML propio como Encino (`content` HTML nuevo) o (b) Tiptap existente con las mismas 13 acciones sobre `body` markdown (mismo comportamiento, distinta persistencia). Ver §3 |
| 13 | Imágenes en el cuerpo (MediaPicker: biblioteca / subir / Unsplash) | `media-picker.tsx`; `actions/media.ts`; `media_items` (mig 0014) | `media_items` | edit | Unsplash ya existe (`searchCoverImages`, `unsplash-picker.tsx`); no hay biblioteca de medios | subir a R2 con la validación existente; **biblioteca de medios (`media_items`) NO se porta** salvo decisión: es un módulo aparte de Encino (worktree-media-library) |
| 14 | SEO: `seo_title` (≤70), `meta_description` (≤160), `noindex`, `nofollow` | mig 0010; `blog-editor.tsx` tab SEO | columnas | edit | `seo.metaTitle`, `seo.metaDescription`, `seo.noindex` (jsonb) | reutilizar `seo` jsonb; añadir `seo.nofollow` (sin migración) |
| 15 | Vista previa SERP (tarjeta Google en vivo) | `blog-editor.tsx:1703-1731` | — | — | `preview-stage.tsx` (SERP + OG + artículo) | reutilizar |
| 16 | FAQ (pares pregunta/respuesta; `<dl>` público; JSON-LD FAQPage; generador IA) | mig 0011; `blog-editor.tsx` «Preguntas y respuestas»; `(es)/blog/[slug]/page.tsx:189-205,112-131` | `faq jsonb` | edit | **no existe** | columna `faq jsonb` (aditiva) + render público + `FAQPage` en `BlogPostingStructuredData` |
| 17 | Google Maps embed validado (`google.*/maps/embed`) | `blog-html.ts` `extractMapsEmbedUrl`; render `[slug]/page.tsx:207-223`; mig 0012 | `maps_embed` | edit | **no existe** | columna `maps_embed` + validación + `<iframe>` público (CSP: `frame-src 'self'` global en `src/lib/security/csp.ts` → **requiere excepción CSP fuera de mi alcance** → ver §4) |
| 18 | Generación IA del artículo (wizard 4 pasos: brief, tono, audiencia, nº de enlaces) y de FAQ; regenerar con `ai_params` | `actions/ai-article.ts` (Gemini 2.5 Flash, `GEMINI_API_KEY`); `ai-article-dialog.tsx`; mig 0016 | `ai_params jsonb` | edit | generación asíncrona con Anthropic desde brief (`src/lib/blog/actions/drafts.ts`, `ai/generate-post.ts`) | **decisión D-C**: adaptar el wizard al cliente Anthropic existente (sin deps ni env nuevas) o declarar «no implementado por dependencia externa» |
| 19 | Autor (creado por; byline pública) | `created_by` + JOIN users | audit fields | — | `author jsonb {name, uid}` | reutilizar |
| 20 | Lista admin: tabs por estado con conteo, filtros categoría/mes/búsqueda, 20/pág, acciones por fila | `blog/page.tsx:39-98`; `blog-filter-bar.tsx`; `queries:144-188` | — | view | `blog-admin-workspace.tsx` (tabs Artículos/Ideas, búsqueda, filtros) | pantalla nueva `/blog-cms` con la estructura de Encino sobre `listAllPosts` extendido (categoría/mes/paginación) |
| 21 | Auditoría de acciones (`blog.*`) | `src/modules/audit` | tabla audit | — | `blog_activity` (`logBlogActivity`) | reutilizar `blog_activity` |
| 22 | Público: índice `/blog` (force-dynamic, hasta 100, filtros `?categoria`/`?etiqueta`, sidebar recientes/categorías/tags) | `(es)/blog/page.tsx:18,37-90` | — | público | `/blog` (ISR 3600, grid, JSON-LD CollectionPage) | añadir filtros por query y sidebar **solo si D-C lo aprueba**; mantener ISR (el barrido de programados exige `revalidatePath` al publicar) |
| 23 | Público: artículo `/blog/[slug]` (metadata title/description/robots por post; JSON-LD Breadcrumb+BlogPosting+FAQPage; contenido HTML; FAQ; Maps; tags; byline) | `(es)/blog/[slug]/page.tsx:29-236` | — | público | `/blog/[slug]` (ISR 86400; metadata + canonical; JSON-LD BlogPosting+Breadcrumb; TOC; related; 308 de slugs viejos; beacon de vistas) | añadir FAQ, `nofollow` en robots, tags, (Maps sujeto a CSP); conservar TOC/related/canonical/redirects (superconjunto) |
| 24 | Borradores/programados/archivados NO públicos | `findPublishedBlogPostBySlug` (`status='published'`) | — | público | `getPublishedPostBySlug` (`status='published'`) | igual |
| 25 | Sitemap (solo posts publicados; `lastModified`; imagen) | `src/app/sitemap.ts:193-199` | — | público | `src/app/sitemap.ts:16-29` (`getPublishedPosts`) | igual (+ `images` opcional) |
| 26 | Revalidación tras guardar (`/blog`, `/blog/{slug}`, slug viejo, admin) | `blog.ts:250-279` | — | — | `revalidatePublicSurfaces()` (`posts.ts:28`) | reutilizar y añadir `/blog-cms` |
| 27 | Permisos admin separados de la lectura pública | `requireResourceAction` por acción; layout `(protected)` | `role_permissions` | — | middleware `PROTECTED_PATHS` + `requireUserSession`/`requireAdmin` por acción | `ADMIN_ROUTES` + guards existentes: leer/crear/editar = sesión (admin/staff); publicar/archivar/eliminar/slug = `requireAdmin`; reviewer 403 por middleware |
| 28 | GC de borradores vacíos (10 min) y descarte al cerrar el wizard | `queries:361,383`; `blog.ts:118` | — | create | no existe | portar (barrido en render de `/blog-cms`) |

## 2. NO existe en Encino — deliberadamente NO se implementa

Vista previa de borrador / token de preview · papelera o soft-delete · excerpt/auto-excerpt (el «resumen» es `meta_description`) · tiempo de lectura (PixelTEC OS lo tiene; se conserva, no es de Encino) · galería multi-imagen · páginas públicas por categoría/etiqueta · paginación pública · RSS · edición/renombrado de categorías · anidamiento >1 nivel · categoría por FK · selección de autor · posts relacionados / anterior-siguiente (PixelTEC OS ya tiene related: se conserva) · comentarios · importador WordPress (el «WordPress» de Encino es solo convención de UI) · R2 para el blog (Encino usa filesystem; PixelTEC OS usa R2: adaptación obligatoria (9), no invención) · ISR (Encino es `force-dynamic`; PixelTEC OS conserva ISR + revalidación) · cron · librería de editor · saneado en `onPaste` · tests (0 en Encino) · blog EN desde BD.

## 3. Diferencias de modelo: `blog_posts` legacy (PixelTEC OS) vs Encino

| Concepto | PixelTEC OS (`src/lib/db/schema.ts` 1402-1441) | Encino (`schema/blog-posts.ts` 44-93) | Conflicto |
|---|---|---|---|
| Cuerpo | `body` **markdown** (Tiptap ⇄ markdown roundtrip; render `markdown-renderer.tsx` con rehype-sanitize) | `content` **HTML** saneado por allowlist propia | **sí**: formato de persistencia |
| Resumen | `excerpt` (obligatorio, ≤ gate) | no existe; `meta_description` | menor |
| SEO | `seo` jsonb: metaTitle, metaDescription, canonicalUrl, noindex, primaryKeyword, secondaryKeywords, searchIntent, contentPillar, ogImageAlt | columnas `seo_title`, `meta_description`, `noindex`, `nofollow` | representación; falta `nofollow` |
| Categoría | texto de unión cerrada (4 valores) | texto libre + tabla `blog_categories` | falta tabla |
| Etiquetas | `tags text[]` | `tags text[]` | igual |
| Estado | `draft \| needs-review \| approved \| published \| archived` (gate editorial) | `draft \| published \| scheduled \| archived` | falta `scheduled`; PixelTEC tiene 2 estados más |
| Programación | no | `scheduled_at` | falta |
| FAQ | no | `faq jsonb` | falta |
| Maps | no | `maps_embed` | falta |
| Portada | `cover_image` (R2) + `seo.ogImageAlt` | `cover_image` (local) + `cover_image_alt` | equivalente |
| IA | `brief_source`, `ai` (model, generatedAt, editedByHuman…), `brief_id` | `ai_params` (brief, tone, audience, link counts) | representación |
| Editorial | `editorial`, `sources`, `internal_links`, `approved_by`, `word_count`, `reading_time_min` | no | PixelTEC superconjunto |
| Autor | `author jsonb` | `created_by` FK | equivalente |
| Revisiones | `blog_post_versions` (reason, snapshot completo) | `blog_post_revisions` | equivalente |
| Redirects de slug | `post_redirects` | no | PixelTEC superconjunto |
| Vistas | `blog_post_view_counts` | no | PixelTEC superconjunto |
| Actividad | `blog_activity` | audit global | equivalente |

## 4. Opciones para D-C

### Opción A — evolución aditiva del modelo legacy (recomendada)

- Migración `0043_blog_encino_parity.sql` (aditiva, idempotente): `ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS faq jsonb NOT NULL DEFAULT '[]'`, `scheduled_at timestamptz`, `maps_embed text`, `ai_params jsonb`; `CREATE TABLE IF NOT EXISTS blog_categories (id uuid pk, name text unique, slug text not null default '', parent_id uuid references blog_categories(id) on delete set null, description text not null default '', created_at, updated_at)`; índice `blog_posts_status_scheduled_idx (status, scheduled_at)`. `status` sigue siendo `text`: `'scheduled'` no exige migración. `seo.nofollow` vive en el jsonb.
- Cuerpo: el editor nuevo usa **Tiptap existente** con las 13 acciones de Encino y persiste en `body` markdown (roundtrip ya probado por `markdown-roundtrip.test.ts`). Las imágenes redimensionables (`width:N%`) no sobreviven al markdown → se implementa como en Encino solo si D-C elige HTML; con markdown se documenta como diferencia.
- Público: `/blog` y `/blog/[slug]` existentes ganan FAQ (+FAQPage), `nofollow`, tags y filtros `?categoria`/`?etiqueta`; conservan ISR, TOC, related, canonical, redirects y beacon. Maps: solo si se autoriza la excepción CSP (`frame-src`) — fuera de mis paths (`src/lib/security/**`): se deja el punto de integración y se marca «pendiente decisión».
- Rollback: revertir código; la migración queda (columnas nulas/por defecto no rompen el código previo); `DROP` documentado pero no ejecutado.
- Impacto en pixeltec.mx: cero cambio de URLs ni de posts existentes; los posts legacy siguen publicados con FAQ vacío.
- Tests: acciones (permisos, validación zod, transiciones de estado, scheduling, slug), queries (filtros), sanitización/roundtrip, público (borrador 404, metadata, sitemap), smoke con dev server.

### Opción B — módulo separado (`blog_cms_posts` + tablas propias)

- Copia fiel del modelo de Encino en tablas nuevas; admin `/blog-cms` sobre ese modelo; público: o (B1) segunda superficie pública (colisiona con `/blog` → necesitaría otro prefijo, p. ej. `/articulos` — cambio de contrato público, decisión de Miguel) o (B2) `/blog` lee de ambas tablas (unión de dos modelos: complejidad y riesgo SEO).
- Ventaja: aislamiento total del legacy. Desventaja: dos blogs en la misma BD, duplicación de sitemap/revalidación/R2, y el /blog de pixeltec.mx no mostraría lo escrito en el Blog nuevo salvo B2.
- Rollback: `DROP` de tablas nuevas (aditivas), revert de código.

### Recomendación

**Opción A** (evolución aditiva): un solo blog y una sola tabla; PixelTEC OS ya cubre 19 de las 28 capacidades y es superconjunto en slug/redirects/SEO/versiones/R2/gate; lo que falta es aditivo (5 columnas + 1 tabla). El «Blog anterior» (`/blog-admin`, pipeline editorial con briefs/gate/stages) queda `legacy` (oculto) y el nuevo `/blog-cms` reproduce las pantallas y el flujo de Encino sobre las mismas filas.

## 6. Ejecución (D-C aprobada, 2026-08-25)

`[Verificado en código]` Opción A implementada tal cual, sin ampliar ni reinterpretar. Drift respecto a lo documentado en §1–§5: **ninguno detectado** durante la implementación.

- **Migración `drizzle/0043_blog_encino_parity.sql`**: aditiva/idempotente (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, FKs en bloque `DO $$ ... IF NOT EXISTS`). Aplicada en la BD de **dev** (`pixeltec-os-db`, 127.0.0.1:5437) con fila de control en `drizzle.__drizzle_migrations` (mismo patrón que 0042); re-aplicada dos veces sin error (confirma idempotencia). **NO aplicada en prod.**
- **`src/lib/db/schema.ts`**: `blogPosts` gana `faq jsonb NOT NULL DEFAULT '[]'`, `scheduledAt`, `mapsEmbed`, `aiParams` + índice `(status, scheduledAt)`; tabla nueva `blogCategories` (`name` unique, `slug`, `parentId` 1 nivel, `description`, `createdBy`).
- **Capa de dominio** `src/lib/blog-cms/{transitions,maps-embed,ai-params,schemas}.ts` — PURAS, con test unitario cada una (33 tests): transición de estado por intención (`autosave|draft|publish|schedule`, paridad exacta con `saveBlogPostAction` de Encino), validación del embed de Maps (allowlist de host, sin URLs ajenas), tonos del wizard IA, zod en frontera.
- **`src/lib/blog-cms/queries.ts`**: reutiliza `serializePost` del blog legacy (misma tabla); `publishDueScheduledPosts` con el MISMO throttle de 60 s/proceso que Encino (11 tests, incl. `force` para tests/backfill); `uniqueBlogSlug` con el mismo bucle `-2…-50` evitando `post_redirects`; `deleteAbandonedEmptyDrafts`/`deleteBlogPostIfEmpty`; categorías (`upsertBlogCategory` con `onConflictDoNothing`, igual que Encino: nunca edita una existente).
- **`src/lib/blog-cms/actions.ts`** (`'use server'`): permisos backend — **leer/crear/guardar borrador/autosave exigen sesión** (`requireUserSession`); **publicar/programar/archivar/restaurar/eliminar/categorías exigen `requireAdmin`** (política más estricta que Encino en publicar, consistente con el gate editorial ya vigente en PixelTEC OS — IA sin revisión humana no publicable, PR #50 legacy). 22 tests cubren cada gate denegado y concedido, transición `scheduled`, gate de integridad al publicar, dedupe de categoría/slug.
- **`src/lib/blog-cms/ai.ts`** (D-C-bis): `generateBlogCmsArticle`/`generateBlogCmsFaq` sobre `anthropicCreate` (`@/lib/ai/anthropic-egress`, política ADR-0028 ya vigente) — el catálogo de enlaces internos se arma desde `getPublishedPosts()` + páginas fijas (el modelo nunca inventa una URL, igual que Encino). Sin `GEMINI_API_KEY` ni SDK nuevo.
- **Editor** (`src/components/blog/cms/editor.tsx`) sobre `RichMarkdownEditor` (Tiptap ya existente): las 13 acciones de Encino equivalen a los botones ya soportados (H2/H3/¶/negrita/cursiva/listas/cita/código/enlace/imagen/tabla/deshacer/rehacer) más una acción nueva: **subida de imagen del cuerpo** (`onUploadImage`, nuevo prop) a `/api/blog/image` (mismo endurecimiento que la portada: admin, sin SVG, 5 MB, magic bytes). Inspector de 4 pestañas (Publicar · Contenido · SEO · Snippets). **CORRECCIÓN FASE 11 (2026-08-26):** esta línea decía que la pestaña «Snippets» «depende del módulo SEO Control Center, ausente en PixelTEC OS» y la daba por no portable. **Era falso.** La dependencia era del LUGAR de guardado (Encino usa el ajuste global `seo_page_schema`), no de una capacidad: `blog_posts.seo` es jsonb y ya admitía campos aditivos sin migración (`coverAttribution`, `nofollow`). La pestaña está portada en FASE 11 — ver `WO-2026-00088-fase11-paridad.md`.
- **Público** (`src/app/blog/{page,layout,blog-grid}.tsx`, `[slug]/{page,blog-post-client}.tsx`, `sitemap.ts`): FAQ (`<dl>` + `FAQPageStructuredData`), etiquetas (pills + filtro `?etiqueta=`), Maps embed (`<iframe>` server-validado), filtro `?categoria=`, `robots.follow` gobernado por `seo.nofollow`, barrido de programados antes de listar/servir/sitemapear. ISR, TOC, relacionados, canonical, redirects de slug y beacon de vistas **se conservan intactos** (superconjunto de Encino, no se tocaron).
- **CSP** (`src/lib/security/csp.ts`): excepción mínima Miguel/SC-2 — `frame-src` gana `https://www.google.com` (Encino no tiene CSP; el host es el mínimo comprobado para el embed oficial). `csp.test.ts` fija que `default-src`/`script-src`/`connect-src`/`img-src`/`object-src`/`frame-ancestors` NO cambiaron y que la excepción es idéntica en `/whatsapp`, `/cobros`, `/blog`, `/blog-cms` (superficie global, sin relajar nada fuera de Maps).
- **Nav/registro**: `blog-cms` en `ADMIN_ROUTES`; módulo `blog` (`src/lib/modules/registry.ts`) con `routes: ["/blog-cms"]`; área «Blog» en posición 5 de la navegación (Inicio·Clientes·WhatsApp·Finanzas·**Blog**·Usuarios y Accesos).
- **Smoke end-to-end en `localhost:9002`** (Playwright + Chrome, sesión admin real de dev): login → `/blog-cms` → crear (Manual) → editor con título/cuerpo Markdown/SEO/tags/FAQ/Maps → autosave confirmado (`✓ Guardado a las …`) → Publicar → `GET /blog/<slug>` **200**, HTML con `<title>`, `rel="canonical"` (`https://pixeltec.mx/blog/<slug>`), meta description exacta, `BlogPosting` + `FAQPage` JSON-LD, `<dl>` de FAQ, `<iframe src="https://www.google.com/maps/embed…">`, pills de tags, entrada en `/sitemap.xml` → volver a Borrador → `GET /blog/<slug>` **404** → Programar (+5 min) → `GET /blog/<slug>` **404** (ni borrador ni programado exponen la URL pública) → categoría nueva creada en `/blog-cms/categorias`. Capturas desktop+móvil en `~/Desktop/Archivo/PixelTEC-OS/WO-88/` (`60`–`69`), evidencia JSON en `smoke-blog-report.json`.
- **Verificación de consola sin errores de CSP** al cargar el artículo con el `<iframe>` de Maps (Playwright, `page.on('console')` filtrado por `csp`) — 0 coincidencias. El `<iframe>` no llegó a pintar contenido en la captura porque este entorno sandbox no tiene salida a `google.com` (verificado con `curl` directo: HTTP 400 también desde la terminal, no solo desde el navegador) — es una limitación de red del entorno de desarrollo, no del código ni de la CSP; queda declarada, no maquillada.
- **Comportamiento heredado documentado (no es drift, es reutilización deliberada de `serializePost`)**: un post sin categoría se sirve como `"arquitectura"` (default del serializador legacy compartido, `src/lib/blog/queries/posts.ts:24`) tanto en el DTO público como en el valor inicial del `<select>` del editor — mismo comportamiento que ya tenía `/blog-admin`, ahora también en `/blog-cms`.


## 5. Contrato público real de Encino (para el gate public-blog-surface)

| Punto exigido | Evidencia Encino | Equivalente a validar en PixelTEC OS |
|---|---|---|
| Entrada publicada accesible | `(es)/blog/[slug]/page.tsx:60-75` `findPublishedBlogPostBySlug` → 200 | `GET /blog/<slug>` 200 |
| Slug/ruta | `/blog/{slug}` (+ `trailingSlash: true` en Encino) | `/blog/{slug}` (sin trailing slash; 308 desde slugs viejos) |
| Render del contenido | `dangerouslySetInnerHTML` sobre HTML saneado (:176) | markdown → HTML saneado (`markdown-renderer.tsx`) |
| Imágenes | portada `<Image>` con `FALLBACK_COVER`; imágenes inline | portada R2 con fallback `/og-image.png`; inline por markdown |
| Metadata/SEO | `generateMetadata` (:34-58): title `seoTitle \|\| title`, description, image, `robots {index:!noindex, follow:!nofollow}` | `generateMetadata` (:39-70) + `nofollow` a añadir |
| Canonical | `buildMetadata({slug:"blog/<slug>"})` (canonical = URL propia) | `alternates.canonical = seo.canonicalUrl ?? absoluteUrl('/blog/<slug>')` |
| Sitemap/revalidación | `sitemap.ts:193-199` publicados; `revalidatePath` al guardar | `sitemap.ts` (`force-dynamic`) + `revalidatePublicSurfaces()` |
| Borradores no accesibles | `status='published'` en la query pública; scheduled/archived/draft → `notFound()` | igual; test HTTP 404 |
| Permisos admin separados | `(protected)` layout + `requireResourceAction`; público sin sesión | `PROTECTED_PATHS` (middleware) + guards; `/blog` público sin sesión |
| JSON-LD | Breadcrumb + BlogPosting + FAQPage condicional (:112-131) | BlogPosting + Breadcrumb existentes; FAQPage a añadir |
