# Análisis SEO — PixelTEC OS

**Fecha:** 2026-06-16  
**Dominio:** https://pixeltec.mx  
**Framework:** Next.js 15 App Router

---

## Resumen ejecutivo

El proyecto tiene una base SEO sólida: utility `buildMetadata`, schemas JSON-LD, sitemap dinámico y robots.txt bien configurado. Sin embargo hay **problemas críticos** que afectan indexabilidad real: varias páginas públicas importantes no exportan metadata porque son `'use client'`, y el componente de structured data se inyecta en el cliente.

---

## Hallazgos positivos

| Área | Detalle |
|---|---|
| `buildMetadata()` | Centraliza canonical, OG, Twitter card — consistente en todas las páginas que lo usan |
| `metadataBase` | Correctamente definido en `layout.tsx` (`https://pixeltec.mx`) |
| Title template | `%s \| PixelTEC` — bien configurado en el root layout |
| `lang="es-MX"` | Correcto para audiencia mexicana |
| Font optimization | Poppins, Roboto, League Spartan con `display: 'swap'` vía `next/font/google` |
| Sitemap dinámico | `sitemap.ts` incluye posts de Firestore, prioridades correctas, `revalidate: 3600` |
| robots.txt | Bloquea correctamente todas las rutas admin y `/api/` |
| Redirects 301 | `/nosotros → /about`, `/contacto → /contact`, `/servicios → /services`, slug de blog |
| OG image | Dimensiones correctas (1200×630 px) |
| Blog metadata | `generateMetadata` dinámico con `metaTitle`/`metaDescription` desde Firestore, `og:type: article`, `publishedTime`, autor |
| noindex por post | Soporte en Firestore (`seo.noindex`) aplicado en `generateMetadata` |
| Structured data | Organization + WebSite schemas en todas las páginas (root layout), Service schema, BlogPosting schema |
| Schemas de blog | `BlogPosting` con headline, datePublished, author, publisher, image, mainEntityOfPage |

---

## Problemas críticos

### C1 — Páginas públicas importantes sin metadata (pérdida de indexabilidad directa)

**Causa:** Next.js ignora `export const metadata` en archivos marcados `'use client'`. Estas páginas están siendo rastreadas e indexadas con el título/descripción que Google infiere del contenido, no el que tú defines.

| Página | Ruta | Impacto comercial |
|---|---|---|
| `/services` | `src/app/services/page.tsx` | **Alto** — priority 0.9 en sitemap, página de conversión principal |
| `/contact` | `src/app/contact/page.tsx` | **Alto** — lead generation |
| `/about` | `src/app/about/page.tsx` | **Medio** — señal E-E-A-T |
| `/metodologia` | `src/app/metodologia/page.tsx` | **Medio** |
| `/terminos-de-servicio` | `src/app/terminos-de-servicio/page.tsx` | Bajo |
| `/aviso-de-privacidad` | `src/app/aviso-de-privacidad/page.tsx` | Bajo |
| `/data-deletion` | `src/app/data-deletion/page.tsx` | Bajo |
| `/guias-transformacion` | `src/app/guias-transformacion/page.tsx` | Bajo |

**Solución para cada página:**

Opción A (rápida, sin refactor): agregar un `layout.tsx` al directorio que exporte `metadata` como Server Component.

```tsx
// src/app/services/layout.tsx
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  path: '/services',
  title: 'Servicios · Ecosistemas Web, Automatización y Consultoría',
  description: 'Desarrollamos tecnología a la medida: ecosistemas web Next.js, automatización con IA y consultoría tecnológica para empresas en México.',
});

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

Opción B (correcta a largo plazo): separar la lógica de datos/metadata en un Server Component padre y dejar solo la UI interactiva en el Client Component hijo.

---

### C2 — `OrganizationStructuredData` se inyecta desde el cliente

**Archivo:** `src/components/seo/structured-data.tsx` — tiene `"use client"` en la línea 1.

Google puede renderizar JS, pero los crawlers de redes sociales (LinkedIn, WhatsApp, Telegram, Facebook) NO ejecutan JS. Cuando alguien comparte `pixeltec.mx`, esas plataformas no verán el schema de Organization ni el de WebSite.

**Solución:** Eliminar `"use client"` del componente. Los scripts JSON-LD no necesitan hooks ni estado — son strings estáticos. El componente puede ser un Server Component puro.

```tsx
// src/components/seo/structured-data.tsx
// Eliminar la línea: "use client";

export function OrganizationStructuredData() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
      />
    </>
  );
}
```

---

### C3 — Blog en `force-dynamic` con `revalidate = 0`

**Archivos:** `src/app/blog/page.tsx` y `src/app/blog/[slug]/page.tsx`

Ambas páginas usan `dynamic = 'force-dynamic'`, lo que significa que Next.js **no genera HTML en build time ni lo cachea**. Cada visita del crawler genera el HTML desde cero con una llamada a Firestore. Esto:

- Penaliza el TTFB (tiempo de primer byte), factor de ranking en Google
- Impide que Google vea una versión pre-renderizada estable
- Consume quota de Firestore innecesariamente

**Solución:**

```tsx
// src/app/blog/page.tsx
export const revalidate = 3600; // ISR: regenerar cada hora
// eliminar: export const dynamic = 'force-dynamic';

// src/app/blog/[slug]/page.tsx
export const revalidate = 86400; // ISR: regenerar cada día
// eliminar: export const dynamic = 'force-dynamic';

// Opcional: pre-renderizar los slugs conocidos en build time
export async function generateStaticParams() {
  const posts = await getPublishedPosts();
  return posts.map((p) => ({ slug: p.slug }));
}
```

---

## Problemas medios

### M1 — `sameAs` en Organization schema tiene solo un URL

**Archivo:** `src/components/seo/structured-data.tsx:28`

```js
sameAs: ["https://pixeltec.mx"],  // solo el propio dominio
```

`sameAs` sirve para que Google entienda que la entidad "PIXELTEC" es la misma en múltiples plataformas. Un array con solo el sitio web no aporta nada.

**Corrección:** agregar perfiles reales (LinkedIn, GitHub, directorio de empresa, etc.):
```js
sameAs: [
  "https://www.linkedin.com/company/pixeltec-mx",
  "https://github.com/pixeltec-mx",
  // cualquier perfil verificado
],
```

---

### M2 — WebSite SearchAction apunta a una búsqueda que no existe

**Archivo:** `src/components/seo/structured-data.tsx:36-40`

```js
potentialAction: {
  "@type": "SearchAction",
  target: "https://pixeltec.mx/blog?q={search_term_string}",
},
```

La página `/blog` no implementa búsqueda por query param `?q=`. Si Google valida este schema y descubre que la URL no funciona, puede marcar el schema como inválido.

**Opciones:**
1. Implementar búsqueda en `/blog?q=` (añade valor SEO también)
2. Eliminar el `potentialAction` hasta que exista funcionalidad real

---

### M3 — `keywords` en root layout son técnicas, no de negocio

**Archivo:** `src/app/layout.tsx:39`

```ts
keywords: ['automatización', 'desarrollo web', 'agencias', 'nextjs', 'firebase', 'consultoría tecnológica'],
```

"nextjs" y "firebase" son términos que buscan desarrolladores, no clientes. Google ya no usa el meta keywords para ranking (lo ignora), pero si se usa debe reflejar lo que busca el cliente objetivo.

**Corrección opcional:**
```ts
keywords: [
  'desarrollo web México', 'automatización de procesos', 'CRM personalizado',
  'consultoría tecnológica Puerto Vallarta', 'ecosistemas digitales', 'software a medida',
],
```

---

### M4 — `/guias-transformacion` no está en el sitemap

**Archivo:** `src/app/sitemap.ts`

La ruta `/guias-transformacion` existe en el router pero no aparece en `staticRoutes`. Si tiene contenido relevante, debe agregarse.

```ts
{ url: `${BASE_URL}/guias-transformacion`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
```

---

### M5 — `lastModified` en sitemap siempre es `new Date()`

**Archivo:** `src/app/sitemap.ts`

Las páginas estáticas usan `lastModified: now` (la fecha de cada request al sitemap). Google puede interpretar que todas las páginas cambian en cada crawl, perdiendo la señal de cuándo fue el último cambio real.

**Mejor práctica:** usar fechas fijas por página o la fecha del último deploy. Ejemplo:
```ts
{ url: BASE_URL, lastModified: new Date('2026-06-16'), changeFrequency: "weekly", priority: 1.0 },
```

---

### M6 — Sin favicon dinámico / apple-touch-icon / manifest

**Estado actual:** Solo existe `src/app/favicon.ico` (Next.js default).

Sin `apple-touch-icon` ni `manifest.json`, el sitio no se ve bien cuando se guarda en la pantalla de inicio de un iPhone. Tampoco aparece el color de tema en la barra del navegador móvil.

**Corrección:** crear en `src/app/`:
```
icon.png          — 512×512, para Android y PWA
apple-icon.png    — 180×180, para iOS
```

Next.js 15 los detecta automáticamente. Alternativamente, agregar en `layout.tsx`:
```ts
icons: {
  icon: '/ptlogox.png',
  apple: '/apple-icon.png',
},
themeColor: '#030303',
```

---

## Oportunidades de mejora

### O1 — Sin BreadcrumbList schema en subpáginas

Páginas como `/blog/[slug]`, `/services/[slug]` e `/industrias` se beneficiarían de breadcrumbs en los resultados de búsqueda (rich snippets). Google muestra el path completo en lugar de solo el dominio.

```tsx
// Ejemplo para blog post
const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://pixeltec.mx" },
    { "@type": "ListItem", position: 2, name: "Blog", item: "https://pixeltec.mx/blog" },
    { "@type": "ListItem", position: 3, name: post.title, item: `https://pixeltec.mx/blog/${post.slug}` },
  ],
};
```

---

### O2 — Sin `dateModified` en BlogPosting schema

**Archivo:** `src/components/seo/structured-data.tsx:105-130`

El schema `BlogPosting` solo incluye `datePublished`. Agregar `dateModified` mejora la relevancia percibida por Google, especialmente para posts actualizados.

```ts
dateModified: post.updatedAt ?? post.publishedAt,
```

---

### O3 — `/login` y `/portal` no bloqueados en robots

Son páginas con auth o privadas. No son indexables de facto (auth redirect), pero bloquearlas explícitamente es más limpio:

```ts
disallow: [
  "/login",
  "/portal",
  // ...resto existente
],
```

---

### O4 — OG image es genérica para todas las páginas

`/public/og-image.png` (17.6 KB) se usa como fallback en todas las páginas que no especifican una imagen OG propia. Los posts de blog con `coverImage` ya lo resuelven. Las páginas de servicios e industrias deberían tener imágenes OG específicas (más share rate en redes sociales).

---

### O5 — `/blog-admin` no está en robots disallow

Aunque está protegido por auth middleware (redirect a `/login`), es mejor práctica bloquearlo explícitamente:

```ts
disallow: [
  "/blog-admin",
  // ...
],
```

---

## Resumen priorizado

| # | Problema | Impacto | Esfuerzo | Archivos |
|---|---|---|---|---|
| C1 | Páginas clave sin metadata (`/services`, `/contact`, `/about`) | Crítico | Bajo | Agregar `layout.tsx` por carpeta |
| C2 | Structured data inyectado en cliente | Crítico | Mínimo | Quitar `"use client"` de `structured-data.tsx` |
| C3 | Blog en `force-dynamic` | Alto | Bajo | Cambiar a ISR en `blog/page.tsx` y `blog/[slug]/page.tsx` |
| M1 | `sameAs` incompleto en Organization | Medio | Mínimo | `structured-data.tsx:28` |
| M2 | SearchAction con URL inexistente | Medio | Mínimo | Eliminar o implementar búsqueda |
| M4 | `/guias-transformacion` faltante en sitemap | Bajo | Mínimo | `sitemap.ts` |
| M5 | `lastModified` dinámico en sitemap | Bajo | Bajo | `sitemap.ts` — usar fechas fijas |
| M6 | Sin apple-touch-icon / manifest | Bajo | Bajo | `src/app/` — agregar `icon.png`, `apple-icon.png` |
| O1 | Sin BreadcrumbList | Oportunidad | Medio | `structured-data.tsx` + blog/services pages |
| O2 | Sin `dateModified` en BlogPosting | Oportunidad | Mínimo | `structured-data.tsx:105` |
| O3 | `/login` y `/portal` visibles en robots | Oportunidad | Mínimo | `robots.ts` |
