# Módulo: Blog

Manifiesto del módulo Blog — metodología general en NeuroPIXEL,
`02_PLAYBOOKS/modularizar-y-replicar-capacidad.md`. Este documento es el
**contrato de extracción**: todo lo que hay que copiar, adaptar y verificar
para trasplantar el blog a otro proyecto del mismo stack (Next.js 15 App
Router + Postgres + Drizzle + NextAuth v5 + Cloudflare R2 + Tailwind).

No es documentación de uso del blog (eso vive en el propio código, comentado
inline). Es el **inventario y las fronteras** que necesita un agente o
desarrollador para replicarlo sin releer todo el repo.

## 1. Qué hace

Blog editorial completo: listado público (`/blog`), detalle (`/blog/[slug]`)
con redirects 301 históricos, dashboard de administración (`/blog-admin`),
editor con generación de borradores por IA (Anthropic), versionado
inmutable, gate de publicación server-side, búsqueda de portadas (Unsplash)
subidas a R2, contador de vistas.

## 2. Archivos que componen el módulo

```
src/app/blog/                              # rutas públicas
  layout.tsx  page.tsx  blog-grid.tsx
  [slug]/page.tsx  [slug]/blog-post-client.tsx

src/app/(admin)/blog-admin/                # rutas de administración (dentro del
  page.tsx  blog-admin-logic.ts(+.test)     # grupo protegido (admin) del proyecto destino)
  blog-admin-workspace.tsx  new-article-menu.tsx  status-chip.tsx  tag-input.tsx
  [id]/editar/  (post-editor-client.tsx, ai-tools-menu.tsx, editorial-panel.tsx,
    internal-links-editor.tsx, preview-panel.tsx, readiness-panel.tsx, seo-panel.tsx,
    slug-card.tsx, sources-editor.tsx, unsplash-picker.tsx, versions-card.tsx,
    issue-anchors.ts(+.test), stages/*.tsx(+.test))
  nuevo/  (page.tsx, nuevo-brief-form.tsx)

src/app/api/blog/
  cover/route.ts(+.test)                   # POST subida de portada a R2, admin-gated
  view/route.ts(+.test)                    # POST beacon público de vistas, sin auth

src/lib/blog/                              # todo el dominio — 34 archivos, ~5,100 líneas
  MODULE.md                                # este archivo
  pg.ts  activity.ts  publication-gate.ts(+.test)  workflow.ts(+.test)
  versions.ts(+.test)  public-post.ts(+.test)  heading-utils.ts
  format-date.ts(+.test)  markdown-roundtrip.ts(+.test,+.fixtures)
  schemas.ts  types.ts  ai-tools-logic.ts
  ai/client.ts  ai/generate-brief.ts  ai/generate-post.ts  ai/system-prompt.ts
  queries/posts.ts  queries/drafts.ts
  actions/ai-tools.ts(+.test)  actions/briefs.ts  actions/drafts.ts(+3 tests)
  actions/images.ts  actions/posts.ts  actions/versions.ts

src/components/blog/                       # puramente de blog
  markdown-renderer.tsx  mermaid-diagram.tsx  rich-markdown-editor.tsx
  tiptap-extensions.ts  tiptap-roundtrip.ts(+.test)  view-beacon.tsx
```

## 3. Tablas de base de datos (Postgres/Drizzle)

Definidas en `src/lib/db/schema.ts` (sección "Blog"). Al trasplantar: copiar
el bloque completo de estas 6 tablas.

| Tabla | Migración origen | FK hacia fuera del módulo |
|---|---|---|
| `blog_briefs` | inicial (`0000_powerful_ultimates.sql`) | ninguna |
| `blog_posts` | inicial | ninguna (`author` es JSONB `{name,uid}`, no FK) |
| `post_redirects` | inicial | → `blog_posts.id` (interna al módulo) |
| `blog_post_view_counts` | `0027_blog_view_counts.sql` | → `blog_posts.id` (interna) |
| `blog_activity` | `0029_blog_activity.sql` | → `blog_posts.id` (interna) · **→ `users.id`** ⚠️ |
| `blog_post_versions` | `0034_blog_post_versions.sql` (+ `0035_blog_brief_id.sql` agrega `blog_posts.brief_id` → `blog_briefs.id`) | → `blog_posts.id` (interna) · **→ `users.id`** ⚠️ |

**Único acoplamiento de datos real hacia fuera del módulo: `users.id`** (2
FKs, `onDelete: set null` — nunca bloquea el borrado del usuario). El
proyecto destino necesita una tabla `users` con al menos `id` (uuid) y
`name`.

## 4. Contratos externos requeridos (lo que el proyecto destino debe tener ANTES de trasplantar)

| Contrato | Usado para | Archivo(s) que lo consumen |
|---|---|---|
| Auth con `requireUserSession()` / `requireAdmin()` (NextAuth v5 o equivalente) | Gate de escritura en Server Actions y `api/blog/cover` | casi todas las `actions/*.ts`, `nuevo/page.tsx` |
| Tabla `users` (id, name) | Autoría/auditoría de actividad y versiones | `pg.ts::getUserDisplayName`, FKs de §3 |
| `db` + schema Drizzle-Postgres | Persistencia | todo `queries/*` y `actions/*` |
| Egress guard genérico (`egress-guard.ts`), canales `ai`, `r2`, `unsplash` | Política fail-closed antes de cualquier llamada externa | `ai/*.ts`, `api/blog/cover`, `actions/images.ts` |
| Cliente Anthropic (`ai/anthropic-egress.ts`) | Generación de brief/borrador con IA | `lib/blog/ai/*` |
| R2 (`r2/upload.ts`, `r2/client.ts`) | Subida/borrado de portadas | `api/blog/cover/route.ts` (prefijo fijo `blog/covers/`) |
| Unsplash (`unsplash-egress.ts`) | Búsqueda de portadas | `actions/images.ts` |
| `seo.ts` (`buildMetadata`) + `site-config.ts` (`SITE`, `absoluteUrl`) | Metadata de las páginas públicas | `blog/page.tsx`, `blog/[slug]/page.tsx` |
| `errors/public-failure.ts` (`toPublicFailure`) | Sanear errores hacia el cliente | `actions/images.ts` |
| `Header`/`Footer` de layout + componentes `ui/*` (shadcn) | UI compartida | `blog/layout.tsx`, editor completo |

Si el proyecto destino no tiene alguno de estos contratos ya construidos, ese
es trabajo previo — el módulo no los trae consigo (son capacidades
fundamentales del stack PixelTEC, no parte del módulo Blog).

## 5. Variables de entorno

```
ANTHROPIC_API_KEY              # compartida con otros módulos de IA del proyecto
ANTHROPIC_MODEL                # default claude-opus-4-7 — SOLO para blog, no lo hereda otro módulo de IA
EGRESS_AI_MODE + EGRESS_AI_TARGET_ALLOWLIST + EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION
EGRESS_UNSPLASH_MODE           # opcional (optional:true en validate-egress-config.ts)
UNSPLASH_ACCESS_KEY            # opcional — sin ella, buscador de portadas inactivo
EGRESS_R2_MODE + EGRESS_R2_BUCKET_ALLOWLIST + EGRESS_R2_ALLOW_DELETE + EGRESS_R2_PRODUCTION_BUCKETS
R2_ENDPOINT + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY + R2_BUCKET_NAME + R2_PUBLIC_URL
```

## 6. Registro en el resto de la app (lo que hay que ENGANCHAR, no copiar)

Al trasplantar, además de copiar los archivos de §2, hay que registrar el
módulo en 4 puntos del proyecto destino:

1. **Nav pública** — entrada `{ label: 'Blog', href: '/blog' }` en el
   componente de header/nav global.
2. **Nav admin** — entrada `{ href: '/blog-admin' }` en `nav-config.ts` (o
   equivalente) del shell administrativo.
3. **`ADMIN_ROUTES`** (`src/lib/routes/admin-routes.ts` o equivalente) —
   agregar `'blog-admin'` para que el middleware lo proteja.
4. **`sitemap.ts`** — importar `getPublishedPosts` de
   `lib/blog/queries/posts` para incluir `/blog/[slug]` en el sitemap
   (opcional, pero pierde SEO si se omite).

## 7. Quién depende del módulo (impacto de tocarlo)

Solo `sitemap.ts` importa código real de `lib/blog`. Header y nav-config
solo referencian el string de ruta, no código. Esto significa: el módulo se
puede desactivar (quitar del sitemap + quitar las 3 entradas de registro de
§6) sin dejar imports rotos en el resto de la app — cumple la filosofía
modular de Foundation §7 ("desactivar un módulo opcional no deja código
muerto ni imports rotos").

## 8. Estado de madurez (Foundation, §11)

**Candidato, NO promovido a Foundation todavía.** Usado en producción en 1
proyecto (PixelTEC OS) — Foundation exige ≥3 proyectos antes de una
promoción real (ver `08_REFERENCIA/foundation/arquitectura-v1.md` §10-11).
Este manifiesto existe para que, cuando Miguel pida "mete el módulo blog al
proyecto X", la extracción sea mecánica y verificable — no para saltarse el
criterio de promoción a Foundation.

---
Última verificación de este inventario: 2026-08-07, contra `main` de `pixeltec-os`.
