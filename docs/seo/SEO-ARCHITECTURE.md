# Arquitectura SEO de pixeltec.mx

Cómo está construida la capa SEO tras el incremento `feat/seo-integral-pixeltec`
(2026-08-03). Cambiarla = tocar los módulos de aquí, no duplicarlos.

## Capas y fuentes de verdad

| Capa | Módulo | Regla |
|---|---|---|
| Identidad del sitio | `src/lib/site-config.ts` | ÚNICA fuente de marca ("PixelTEC"), URL, NAP, redes, founder. Dato nuevo de identidad → aquí. |
| Metadata por página | `src/lib/seo.ts` (`buildMetadata`) | Canonical/OG/Twitter/locale; `article` para posts; `noindex` param. NO crear helpers paralelos. |
| JSON-LD | `src/components/seo/structured-data.tsx` | Server Components; `@id` enlaza Organization↔WebSite↔publisher; UN nodo por entidad por página (el Service duplicado del client se eliminó). FAQ solo con paridad texto visible. |
| Rastreo | `src/app/robots.ts` | Disallow DERIVADO de `ADMIN_ROUTES` + login/portal/reset-password/api. Ruta admin nueva se bloquea sola. |
| Descubrimiento | `src/app/sitemap.ts` | `force-dynamic` (el build no tiene DATABASE_URL — NO volver a ISR/estático: el XML se hornea vacío, incidente 2026-08-03). Posts published+noindex-false desde DB. |
| Indexabilidad de privadas | layouts con `robots:{index:false}` | login, portal, reset-password, p/[token]. Disallow ≠ noindex: ambas capas a propósito. |
| Iconos | `src/app/icon.png` (512) + `apple-icon.png` (180 opaco) | Convención de archivos de Next; theme-color vía `export const viewport`. |

## Sistema editorial del blog

- **Modelo**: `blog_posts` + JSONB `seo` (ampliado: primaryKeyword,
  secondaryKeywords, searchIntent, contentPillar, ogImageAlt), `editorial`
  (reviewer/fechas/aiAssisted/claims), `sources[]`, `internal_links[]`;
  tabla `post_redirects` (301 de slugs históricos). Todo aditivo: filas viejas
  leen defaults vía `EMPTY_SEO`/`EMPTY_EDITORIAL` (types.ts) — NO hay backfill.
- **Gate de publicación**: `src/lib/blog/publication-gate.ts` (puro, testeado).
  `publishPost` lo ejecuta EN SERVIDOR + exige rol admin (`requireAdmin`).
  Blockers = integridad/confianza; warnings = mejoras. SIN métricas artificiales
  (ni densidad de keywords ni conteo de palabras obligatorio).
- **Semántica de edición**: editar un post `published` NO lo despublica —
  conserva estado, registra `editorial.lastReviewedAt` y revalida
  /blog + /blog/[slug] + sitemap. Despublicar es acción explícita (admin).
- **Slugs**: bloqueados por defecto; `changeSlug` (admin, confirmación) valida
  formato/unicidad (posts + redirects), crea el 301 y evita loops. Dedup
  legible `-2`, `-3`.
- **IA**: frontera `anthropic-egress` intacta; prompt v2 exige fuentes del
  brief o `[FUENTE PENDIENTE]`; front-matter validado con Zod; `ai.model` =
  modelo real del response; `rawOutput` persistido para auditoría.
- **Página pública**: Header/Footer desde `blog/layout.tsx`; TOC con ids
  compartidos (`heading-utils.ts`, misma función RSC↔renderer); fuentes
  verificadas visibles; related por categoría; canonical editorial
  (`seo.canonicalUrl`) manda sobre la derivada; redirects de slug con
  `permanentRedirect` antes del 404.

## Seguridad (invariantes que NO se negocian)

- Cero fetch server-side de URLs de fuentes (SSRF): la verificación es humana
  (checkbox) — si algún día se automatiza, requiere frontera de egress propia
  aprobada.
- CSP nonce+strict-dynamic intacta; scripts de terceros nuevos pasan por
  `csp.ts` o mueren en silencio.
- Publicar/archivar/despublicar/cambiar-slug = rol admin con auditoría de 403.

## Deuda registrada (deliberada, no silenciosa)

1. Literales de NAP/teléfono aún duplicados en UI/emails (footer, header,
   contact, emails, proposal-client) — migrarlos a `site-config` incremental.
2. Tailwind: hoja única (~197KB) con globs de admin — separar público/admin
   requiere medición (no se hizo a ciegas).
3. Páginas `'use client'` completas (services/contact/about/metodologia/
   legales) y nonce en root layout (mata prerender) — RSC-ficación es un
   incremento aparte, propuesto en el reporte G1.
4. Pesos de fuente: 900 y 500 EN USO (verificado) — recorte solo con medición.
5. `firestoreId` como identidad pública dual (2 queries por resolución).
6. `typescript.ignoreBuildErrors: true` en next.config (transversal al repo).
7. Categorías del blog fijas (4) vs `contentPillar` libre — unificar cuando
   los pilares se ratifiquen en la estrategia.
