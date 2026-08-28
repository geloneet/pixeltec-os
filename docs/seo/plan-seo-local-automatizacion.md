# Plan SEO — Páginas locales de Automatización (WO-2026-00128)

**Orden de Miguel (2026-08-28):** revisión completa de SEO de la página pública de pixeltec.mx: internal/external links con el estándar de Muebles Encino (sin Wikipedia, solo alta autoridad), keyword research por servicio, y 4 páginas nuevas: `automatizacion-guadalajara`, `automatizacion-zapopan`, `automatizacion-puerto-vallarta`, `automatizacion-bahia-de-banderas`. Aprobación de ejecución dada de una vez por Miguel; alcance acotado por él mismo a la página pública (no `/admin`).

## 0. Estado previo (auditoría 2026-06-16, `04_PRODUCTOS/PixelTEC OS/seo-audit-2026-06.md`)

Verificado en código (`origin/main` @ `f87d0e2`) que **todos los hallazgos críticos y medios de esa auditoría ya estaban resueltos**: metadata en Server Components para `/services`, `/contact`, `/about` (C1); `structured-data.tsx` sin `"use client"` (C2); blog en ISR (C3); `sameAs` con perfiles reales (M1); sin `SearchAction` roto (M2); `/guias-transformacion` en sitemap (M4); `lastModified` fijo por página (M5); iconos/manifest (M6); breadcrumbs (O1); `dateModified` en BlogPosting (O2); `/login` `/portal` en robots (O3). No se reabrió nada de eso — este WO es trabajo nuevo.

## 1. Regla de enlazado (mismo estándar que Muebles Encino, WO-2026-00075)

- **Internos:** cada página nueva enlaza a `/services/automatizacion`, `/contact`, y a sus ciudades vecinas; `/services/automatizacion` enlaza de vuelta a las 4 ciudades.
- **Externos:** solo alta autoridad — cámaras de comercio/industria (`.org.mx`), gobierno (`.gob.mx`). **Cero Wikipedia** (regla vigente desde Muebles Encino, 2026-08-17). `target="_blank" rel="noopener"`.
- **Verificación:** cada URL externa nueva se probó con `curl -o /dev/null -w "%{http_code}"` antes de publicarse — ver tabla abajo. Las que no respondieron 200 se descartaron (no se usan "reportadas y dejadas", porque son contenido nuevo, no una migración de origen existente).

| Ciudad | Enlace externo | HTTP |
|---|---|---|
| Guadalajara | https://www.canietisedeoccidente.org/ (CANIETI Occidente) | 200 |
| Zapopan | https://www.ccij.org.mx/index/ (INDEX Occidente / CCIJ) | 200 |
| Puerto Vallarta | https://www.puertovallarta.gob.mx/ (Gobierno de Puerto Vallarta) | 200 |
| Bahía de Banderas | https://www.bahiadebanderas.gob.mx/ (Gobierno de Bahía de Banderas) | 200 |

Descartado: `canacovallarta.com` (CANACO Servytur Puerto Vallarta) — no respondió (curl `000`, conexión fallida) en la verificación del 2026-08-28.

## 2. Por qué NO son doorway pages (guía oficial de Google Search Central)

Google penaliza páginas de ciudad casi idénticas que solo cambian el nombre de la ciudad. Cada página de este WO tiene:
- Contexto económico local real y citado (no genérico): clúster tecnológico/IMMEX en Guadalajara, corredor corporativo Puerta de Hierro en Zapopan, sede real de PixelTEC + economía turística en Puerto Vallarta, crecimiento inmobiliario/turístico + CANACINTRA Nayarit en Bahía de Banderas.
- Casos de uso distintos por ciudad (manufactura vs. despachos/aseguradoras vs. hotelería vs. administración de condominios).
- FAQ distinta por ciudad.
- Fuente externa distinta y verificada por ciudad.

Lo único que se repite a propósito es la sección "Cómo trabajamos" (el proceso real de PixelTEC, idéntico en todas las páginas de servicio del sitio) — no es la parte que le da unicidad a la página, es soporte.

## 3. Keyword research (búsquedas reales 2026-08-28)

- **Guadalajara/Zapopan:** nicho de "agencia IA"/"automatización con IA" ya competido (agenciaia.ai, welowmarketing, patatua, duotach, vectoryal indexados). Diferenciación: contexto real del clúster tecnológico (CANIETI/INDEX/IJALTI) en vez de copy genérico.
- **Puerto Vallarta / Bahía de Banderas:** mucho menos competido en automatización de procesos con IA (los resultados se mezclan con automatización física de cocheras/persianas) — oportunidad real de nicho, reforzada por E-E-A-T genuino: PixelTEC tiene su sede ahí (NAP real en `site-config.ts`).

## 4. Alcance técnico implementado

- `src/lib/content/automatizacion-local.ts` — contenido tipado por ciudad.
- `src/components/site/local-automation-page.tsx` — layout compartido (mismo lenguaje visual que `/services/[slug]`).
- `src/app/automatizacion-{guadalajara,zapopan,puerto-vallarta,bahia-de-banderas}/page.tsx` — RSC con `buildMetadata`, `BreadcrumbStructuredData`, `StandaloneServiceStructuredData` (nuevo `areaServedCity`), `FAQPageStructuredData`.
- `src/components/seo/structured-data.tsx` — `StandaloneServiceStructuredData` acepta `areaServedCity` opcional (cae a País si no se pasa, sin romper llamadas existentes).
- `src/app/sitemap.ts` — 4 rutas nuevas.
- `src/app/services/[slug]/service-detail-client.tsx` — bloque "Automatización de procesos en tu ciudad" en la página de servicio con enlace a las 4 ciudades.

## 5. Verificación

- `npx tsc --noEmit` → sin errores.
- `npx next lint` → 0 errores, 0 warnings.
- `NODE_ENV=production npx next build` → EXIT 0, 115 rutas generadas (incluidas las 4 nuevas).
- `vitest run` → 2933 passed, 0 failed.
- Estructura de encabezados (playbook `estructura-contenido-seo`): 1 H1 por página, H2/H3 sin saltos de nivel — verificado con `curl | grep -oE '<h[1-6]...'` en las 4 páginas.
- JSON-LD: Organization/WebSite/Breadcrumb/Service(`areaServed`=Ciudad)/FAQPage — parseados y válidos en las 4 páginas.
- Internal linking verificado en ambas direcciones (`/services/automatizacion` ↔ 4 ciudades) y sitemap.xml confirmado con las 4 URLs.
- **Pendiente:** verificación visual en navegador real (Chrome) — ING-001. La extensión de Chrome no estaba conectada en esta sesión (`Browser extension is not connected`). Dev server queda vivo a propósito en `localhost:9003` para que Miguel lo revise, o para repetir la verificación en cuanto la extensión esté disponible.
