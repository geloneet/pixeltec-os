# Baseline SEO — 2026-08-03

Auditoría G0 del prompt maestro SEO (sesión Claude Code, prod `a1e948c`).
Evidencia cruda: crawl de 28 URLs, Lighthouse local 13.4.1 (móvil, 3 corridas,
mediana), robots/sitemap vivos, 3 pasadas de código con archivo:línea.

## Estado al inicio

- Rendering por página: sólido (SSR real, buildMetadata, canonical, OG, JSON-LD
  Org/WebSite/Service/BlogPosting/Breadcrumb/FAQ, robots.txt correcto).
- De la auditoría de junio (`seo-audit-2026-06` del vault): C1/C2/M2/M4/M5
  corregidos; M1 (sameAs) ausente; M6 (icons) y O4 (OG genérica) vigentes.
- GSC: propiedad `sc-domain:pixeltec.mx`; sitemap reenviado 2026-08-03 (última
  lectura previa: 2026-05-05); 15 indexadas / 33 no (9×404 restos WordPress).

## Hallazgos que motivaron este incremento

**P0**: (1) `updatePost` despublicaba en silencio al editar un post published,
sin revalidar; (2) gate de publicación solo en UI — la action publicaba drafts
sin validar contenido/rol/revisión; (3) artículos sin Header/Footer/related
(casi huérfanos); (4) `/reset-password` indexable y `/portal` sin meta noindex.

**P1**: Service JSON-LD duplicado y divergente en `/services/[slug]` ·
Organization sin sameAs + marca PIXELTEC/PixelTEC inconsistente · auto-save
que perdía campos SEO y fallaba en silencio · canonicalUrl/noindex zombie +
slug inmutable (dedup con Date.now) · 8 páginas públicas 'use client' + framer
78KB global + CSS 197KB (globs admin) + headers() en root mata prerender ·
imágenes sin priority y covers placehold.co · robots desincronizado de
ADMIN_ROUTES + cadena 301 /crm→/dashboard→/hoy · E-E-A-T mínimo (sin
bio/revisor/fuentes, autor "Admin") · relectura de sitemap GSC pendiente.

**P2** (registrados, no todos resueltos aquí): breadcrumbs parciales, TOC/ids
ausentes, alt=título, icons/manifest, og:locale, NAP duplicado (~20 sitios),
identidad dual firestoreId, `ignoreBuildErrors:true`, 10 cortes de fuente,
wizard hidratado en home, 1 solo test del blog, robots.txt con bloque
Cloudflare anti-IA (fuera del repo).

## Lighthouse (lab, medianas de 3 — condiciones registradas en el reporte G0)

| Plantilla | Score | LCP ms | FCP | TBT | CLS | TTFB |
|---|---|---|---|---|---|---|
| / | 0.76 | 5920 | 2077 | 68 | 0.008 | 338 |
| /services | 0.76 | 6174 | 2059 | 71 | 0 | 163 |
| /services/ecosistemas-web | 0.74 | 7962 | 1884 | 100 | 0 | 178 |
| /pixelbot | 0.75 | 6325 | 2068 | 91 | 0.007 | 200 |
| /blog | 0.78 | 5668 | 1923 | 64 | 0 | 179 |
| /blog/[slug] | 0.66 | 9402 | 2055 | 253 | 0 | 286 |
| /diagnostico | 0.77 | 5916 | 1931 | 73 | 0.0001 | 174 |

Lectura: TTFB sano, CLS ≈ 0; el problema es LCP (5.7–9.4s lab móvil) con el
artículo como peor plantilla (cover remota placehold.co + JS). CrUX/campo: sin
datos aún (sitio de tráfico bajo) — Lighthouse es diagnóstico, no veredicto.

## First Load JS por ruta (raw, gzip ≈ 30-33%)

/ 667KB · /services 625KB · /services/[slug] 624KB · /pixelbot 659KB ·
/blog 610KB · /blog/[slug] 493KB · /diagnostico 634KB · /contact 621KB.
CSS global 197KB (Tailwind con globs de admin — deuda registrada).
