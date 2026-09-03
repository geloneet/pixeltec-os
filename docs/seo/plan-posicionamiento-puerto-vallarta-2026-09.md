# Plan de posicionamiento — 13 keywords × (genérica + Puerto Vallarta) · WO-2026-00189

Fecha: 2026-09-02 · Base: `main` `853968e` · Rama: `feature/seo-landings-puerto-vallarta`. Keywords elegidas e investigadas por Miguel (aptas para Puerto Vallarta) `[Decisión aprobada]`; volúmenes sin fuente en el repo `[Hipótesis]` hasta leer Search Console.

## 1. Qué se construye

26 landings públicas: 13 keywords genéricas (intención nacional/MX) + 13 variantes **keyword + Puerto Vallarta** (intención local). Mismo sistema que las 12 landings de ciudad ya existentes (`docs/seo/plan-seo-local-automatizacion.md`): registro tipado de contenido → componente compartido → `buildMetadata` → JSON-LD (`Service` + `FAQPage` + `BreadcrumbList`) → sitemap derivado. Fuente normativa: Google Search Central (páginas útiles y no doorway; consolidación por intención; datos estructurados solo con texto visible).

## 2. Clústeres, intención y URL

Cada página tiene **un ángulo propio** para no canibalizar dentro del clúster; la variante Puerto Vallarta añade contexto local real (industrias: turismo, hotelería, restaurantes, inmobiliario, salud; fuentes `.gob.mx`/`.org.mx` verificadas) y una FAQ local distinta.

| # | Keyword | Slug genérico | Ángulo (intención) | Hub |
|---|---|---|---|---|
| A1 | empresas de desarrollo de software | `/empresas-de-desarrollo-de-software` | cómo elegir una empresa: criterios, señales de alerta, qué entrega PixelTEC | ecosistemas-web |
| A2 | programador de software | `/programador-de-software` | contratar un programador vs un equipo; qué esperar, cómo evaluar | ecosistemas-web |
| A3 | sistemas a medida | `/sistemas-a-medida` | qué es un sistema a medida y cuándo conviene frente a un SaaS | ecosistemas-web |
| A4 | software a medida para empresas | `/software-a-medida-para-empresas` | beneficios y retorno para empresas medianas; proceso y qué influye en el costo | ecosistemas-web |
| A5 | sistema personalizado para empresas | `/sistema-personalizado-para-empresas` | casos: inventario, cotizaciones, CRM, integración con lo que ya usan | ecosistemas-web |
| B1 | automatiza tu negocio | `/automatiza-tu-negocio` | guía por área: ventas, cobros, atención, operaciones; por dónde empezar | automatizacion |
| B2 | automatizar mensajes de whatsapp | `/automatizar-mensajes-de-whatsapp` | cómo se automatizan mensajes: respuestas, plantillas, flujos, límites de Meta | automatizacion + pixelbot |
| B3 | automatizar whatsapp business | `/automatizar-whatsapp-business` | WhatsApp Business app vs API: qué se puede automatizar en cada una, coexistencia | automatizacion + pixelbot |
| B4 | automatizacion de mensajes en whatsapp | `/automatizacion-de-mensajes-en-whatsapp` | casos por industria y métricas (tiempo de respuesta, conversión, carga del equipo) | automatizacion + pixelbot |
| C1 | desarrolladores de app | `/desarrolladores-de-app` | el equipo detrás de una app: perfiles, roles, cómo trabajamos | ecosistemas-web |
| C2 | desarrollo de app | `/desarrollo-de-app` | proceso completo de una app: descubrimiento → diseño → construcción → publicación → mantenimiento | ecosistemas-web |
| C3 | desarrolladores de apps | `/desarrolladores-de-apps` | tipos de app que construimos: web app, PWA, móvil; cuándo cada una | ecosistemas-web |
| C4 | desarrollo de aplicaciones moviles | `/desarrollo-de-aplicaciones-moviles` | iOS, Android y PWA: decisión técnica, tiendas, costos de mantener | ecosistemas-web |

Variante local: mismo slug + `-puerto-vallarta` (patrón ya existente `automatizacion-puerto-vallarta`). Title/H1 local: «<keyword> en Puerto Vallarta». `areaServedCity: "Puerto Vallarta"` en el JSON-LD `Service`.

## 3. Arquitectura en el repo

- `src/lib/content/keyword-landings.ts`: interfaz `KeywordLanding` (slug, keyword, h1, metaTitle ≤ 60, metaDescription ≤ 155, intro, secciones `{title, body[]}` (2–4), `useCases[]`, `faq[]` (5, texto idéntico al JSON-LD), `externalSources[]` (solo `.gob.mx`/`.org.mx`, verificadas con `curl -sI`), `relatedSlugs[]` (clúster + variante local/genérica), `hub` (`ecosistemas-web|automatizacion`), `city?` (`{ name: "Puerto Vallarta", region: "Jalisco" }`), `ctaVerb`). Contenido dividido por clúster en `keyword-landings-{software,whatsapp,apps}.ts` y agregado en `KEYWORD_LANDINGS`.
- `src/components/site/keyword-landing-page.tsx`: componente compartido (patrón `local-service-page.tsx`): back-link, hero con H1 único, intro, secciones H2 con H3 en listas, casos de uso, «Cómo trabajamos» (proceso real fijo), FAQ, CTA, «Relacionado» (relatedSlugs) y, si hay `city`, bloque de contexto local con fuentes.
- `src/app/<slug>/page.tsx` × 26: wrapper de ~40 líneas idéntico al de las landings locales (`buildMetadata`, `BreadcrumbStructuredData`, `StandaloneServiceStructuredData`, `FAQPageStructuredData`), generado por `scripts/gen-keyword-landing-pages.mjs` para evitar errores de copia.
- `src/app/sitemap.ts`: `KEYWORD_LANDINGS.map(...)` junto a las ciudades (prioridad 0.7, `changeFrequency: monthly`).
- Enlazado interno: `src/app/services/[slug]/service-detail-client.tsx` muestra «Guías y servicios relacionados» por hub (genéricas + PV); `/pixelbot` enlaza al clúster B; cada landing enlaza a su variante y a su clúster; las landings de ciudad de Puerto Vallarta ya existentes enlazan a las nuevas PV de su hub. Header/footer/home no cambian.

## 4. Reglas de contenido (playbook `estructura-contenido-seo` + `SEO-OPERATIONS-GUIDE §6`)

Un H1; intro inmediata; H2 por sección; H3 solo dentro de H2; nada de UI en el outline. ≥ 600 palabras únicas por página, español de México, voz PixelTEC (directa, sin humo). **Cero datos inventados**: sin precios concretos, sin clientes que no existan, sin cifras sin fuente; los ejemplos se presentan como escenarios. Claims sobre WhatsApp/Meta solo los verificables en su documentación pública. CTA a `/contact` o `/diagnostico` según intención.

## 5. Verificación antes de cerrar

`tsc --noEmit` 0 · `next lint` 0 · `vitest run` verde · `next build` con +26 rutas · por cada página: `curl` de encabezados (1 H1, jerarquía), JSON-LD parseable, canonical correcta, aparece en `/sitemap.xml` · smoke en navegador (desktop y 390 px) de al menos 3 páginas de clústeres distintos · fuentes externas 200 · `URL-INTENT-MAP.md` actualizado con las 26 filas.

## 6. Medición y siguientes pasos (después del deploy)

Search Console: enviar sitemap, pedir indexación de las 26, leer impresiones/CTR a 14 y 30 días con fecha; ajustar titles con CTR bajo. Perfil de Negocio de Google apuntando a las PV. Enlaces desde el blog (artículos del clúster B) y desde `/industrias`. Si dos páginas del mismo clúster compiten por la misma consulta en GSC, consolidar con 301 (decisión de Miguel con datos).

## 7. Riesgos

- **Canibalización interna** en clústeres B y C (keywords casi sinónimas): mitigada con ángulos distintos y enlazado jerárquico; se vigila en GSC.
- **Páginas doorway** si las PV repiten la genérica con el nombre cambiado: prohibido por regla del registro; contexto y FAQ locales propios.
- **Indexación lenta**: 26 URL nuevas a la vez; sitemap + enlazado interno desde hubs con autoridad.
