# SEO Full Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir todos los problemas SEO encontrados en `docs/seo-analysis.md` — metadata faltante, structured data client-side, blog sin caché, schemas incompletos y robots/sitemap desactualizados.

**Architecture:** Todos los cambios son en archivos de configuración o layout de Next.js 15 App Router. Sin nuevas abstracciones — se extiende `buildMetadata()` existente en `src/lib/seo.ts` y `src/components/seo/structured-data.tsx`. El blog cambia de `force-dynamic` a ISR.

**Tech Stack:** Next.js 15 App Router, TypeScript, `next/font`, JSON-LD structured data vía `dangerouslySetInnerHTML`.

---

## Estado real antes de empezar (leer primero)

Tras revisar el código, el estado actual es:

| Página | ¿Tiene layout.tsx? | ¿Usa buildMetadata? | Estado |
|---|---|---|---|
| `/services` | ✅ | ✅ | OK — ya resuelto |
| `/contact` | ✅ | ✅ | OK — ya resuelto |
| `/about` | ✅ | ✅ | OK — ya resuelto |
| `/metodologia` | ✅ | ✅ | OK — ya resuelto |
| `/terminos-de-servicio` | ✅ | ❌ | Falta canonical/OG/Twitter |
| `/aviso-de-privacidad` | ✅ | ❌ | Falta canonical/OG/Twitter |
| `/guias-transformacion` | ✅ | ❌ | Falta canonical/OG/Twitter |
| `/data-deletion` | ❌ | ❌ | Sin layout — sin metadata |

---

## Mapa de archivos

| Archivo | Acción | Tarea |
|---|---|---|
| `src/components/seo/structured-data.tsx` | Modificar | T1, T5, T7 |
| `src/app/blog/page.tsx` | Modificar | T2 |
| `src/app/blog/[slug]/page.tsx` | Modificar | T2 |
| `src/app/terminos-de-servicio/layout.tsx` | Modificar | T3 |
| `src/app/aviso-de-privacidad/layout.tsx` | Modificar | T3 |
| `src/app/guias-transformacion/layout.tsx` | Modificar | T3 |
| `src/app/data-deletion/layout.tsx` | Crear | T3 |
| `src/app/layout.tsx` | Modificar | T4 |
| `src/app/sitemap.ts` | Modificar | T6 |
| `src/app/robots.ts` | Modificar | T8 |

---

## Task 1: C2 — Quitar `"use client"` de structured-data.tsx

**Problema:** Los schemas JSON-LD (Organization, WebSite, Service, BlogPosting) se inyectan desde el cliente. Los crawlers de redes sociales (LinkedIn, WhatsApp, Telegram) no ejecutan JS y no ven estos schemas.

**Archivos:**
- Modify: `src/components/seo/structured-data.tsx`

- [ ] **Step 1: Verificar el problema actual**

```bash
head -2 src/components/seo/structured-data.tsx
```
Expected output: `"use client";` en línea 1. Si no aparece, este task ya está resuelto.

- [ ] **Step 2: Eliminar la directiva "use client"**

Abrir `src/components/seo/structured-data.tsx` y eliminar únicamente la línea 1:

```
"use client";
```

El archivo debe quedar comenzando directamente con:
```tsx
const organizationSchema = {
```

No cambiar nada más del archivo.

- [ ] **Step 3: Verificar que TypeScript no se rompe**

```bash
npm run typecheck
```
Expected: sin errores relacionados con `structured-data`.

- [ ] **Step 4: Commit**

```bash
git add src/components/seo/structured-data.tsx
git commit -m "fix(seo): make structured-data a Server Component — remove use client

JSON-LD scripts are static strings, no hooks needed.
Social crawlers (LinkedIn, WhatsApp, Telegram) now receive schemas SSR."
```

---

## Task 2: C3 — Blog de force-dynamic a ISR

**Problema:** `blog/page.tsx` usa `dynamic = 'force-dynamic'` + `revalidate = 0` y `blog/[slug]/page.tsx` usa `dynamic = 'force-dynamic'`. Cada visita del crawler genera el HTML desde cero: mal TTFB, sin versión pre-renderizada estable.

**Archivos:**
- Modify: `src/app/blog/page.tsx`
- Modify: `src/app/blog/[slug]/page.tsx`

- [ ] **Step 1: Verificar estado actual en blog/page.tsx**

```bash
grep -n "dynamic\|revalidate" src/app/blog/page.tsx
```
Expected output:
```
9:export const dynamic = 'force-dynamic';
10:export const revalidate = 0;
```

- [ ] **Step 2: Actualizar blog/page.tsx**

Abrir `src/app/blog/page.tsx` y reemplazar las líneas 9–10:

```tsx
// Antes:
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Después:
export const revalidate = 3600; // ISR: regenerar máximo cada hora
```

- [ ] **Step 3: Verificar estado actual en blog/[slug]/page.tsx**

```bash
grep -n "dynamic\|revalidate" src/app/blog/[slug]/page.tsx
```
Expected output:
```
11:export const dynamic = 'force-dynamic';
```

- [ ] **Step 4: Actualizar blog/[slug]/page.tsx**

Abrir `src/app/blog/[slug]/page.tsx` y reemplazar línea 11:

```tsx
// Antes:
export const dynamic = 'force-dynamic';

// Después:
export const revalidate = 86400; // ISR: regenerar máximo cada día
```

- [ ] **Step 5: Verificar TypeScript**

```bash
npm run typecheck
```
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/app/blog/page.tsx src/app/blog/[slug]/page.tsx
git commit -m "perf(seo): migrate blog from force-dynamic to ISR

blog/page.tsx: revalidate 3600 (1h)
blog/[slug]/page.tsx: revalidate 86400 (24h)
Reduces Firestore reads on crawl and improves TTFB for Google."
```

---

## Task 3: C1 — Layouts sin buildMetadata y data-deletion sin layout

**Problema:**
1. `/terminos-de-servicio`, `/aviso-de-privacidad` y `/guias-transformacion` tienen `layout.tsx` pero usan el objeto `Metadata` raw — no tienen canonical URL, OG tags ni Twitter card.
2. `/data-deletion` no tiene `layout.tsx` — completamente sin metadata.

**Archivos:**
- Modify: `src/app/terminos-de-servicio/layout.tsx`
- Modify: `src/app/aviso-de-privacidad/layout.tsx`
- Modify: `src/app/guias-transformacion/layout.tsx`
- Create: `src/app/data-deletion/layout.tsx`

- [ ] **Step 1: Verificar estado actual de los tres layouts**

```bash
cat src/app/terminos-de-servicio/layout.tsx
cat src/app/aviso-de-privacidad/layout.tsx
cat src/app/guias-transformacion/layout.tsx
```
Expected: los tres usan `Metadata` directo sin `buildMetadata`. Confirmar que no tienen `canonical`, `openGraph` ni `twitter`.

- [ ] **Step 2: Reemplazar terminos-de-servicio/layout.tsx**

```tsx
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  path: '/terminos-de-servicio',
  title: 'Términos de Servicio',
  description: 'Consulta los términos y condiciones de servicio para los proyectos de desarrollo, automatización y consultoría de PixelTEC.',
});

export default function TerminosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

- [ ] **Step 3: Reemplazar aviso-de-privacidad/layout.tsx**

```tsx
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  path: '/aviso-de-privacidad',
  title: 'Aviso de Privacidad',
  description: 'Consulta nuestro aviso de privacidad sobre el tratamiento de tus datos personales, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.',
});

export default function AvisoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

- [ ] **Step 4: Reemplazar guias-transformacion/layout.tsx**

```tsx
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  path: '/guias-transformacion',
  title: 'Guías de Transformación Digital',
  description: 'Accede a nuestro centro de recursos exclusivos: playbooks, arquitecturas y estrategias para escalar tu ecosistema digital.',
});

export default function GuiasLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

- [ ] **Step 5: Crear data-deletion/layout.tsx**

```tsx
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  path: '/data-deletion',
  title: 'Eliminación de Datos',
  description: 'Instrucciones para solicitar la eliminación de tus datos personales de los servicios de PixelTEC, conforme a la LFPDPPP.',
});

export default function DataDeletionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

- [ ] **Step 6: Verificar TypeScript**

```bash
npm run typecheck
```
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/app/terminos-de-servicio/layout.tsx \
        src/app/aviso-de-privacidad/layout.tsx \
        src/app/guias-transformacion/layout.tsx \
        src/app/data-deletion/layout.tsx
git commit -m "fix(seo): add canonical+OG metadata to all remaining public pages

- terminos-de-servicio, aviso-de-privacidad, guias-transformacion: migrate
  raw Metadata to buildMetadata (adds canonical, openGraph, twitter card)
- data-deletion: create missing layout.tsx with full metadata"
```

---

## Task 4: M3 — Keywords de negocio en root layout

**Problema:** `src/app/layout.tsx:39` incluye "nextjs" y "firebase" — términos que buscan devs, no clientes. Aunque Google ignora meta keywords para ranking, deben reflejar el negocio real.

**Archivos:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Localizar el campo keywords**

```bash
grep -n "keywords" src/app/layout.tsx
```
Expected: `keywords: ['automatización', 'desarrollo web', 'agencias', 'nextjs', 'firebase', 'consultoría tecnológica'],`

- [ ] **Step 2: Reemplazar el array keywords**

En `src/app/layout.tsx`, reemplazar el campo `keywords`:

```tsx
// Antes:
keywords: ['automatización', 'desarrollo web', 'agencias', 'nextjs', 'firebase', 'consultoría tecnológica'],

// Después:
keywords: ['desarrollo web México', 'automatización de procesos', 'CRM personalizado', 'consultoría tecnológica Puerto Vallarta', 'ecosistemas digitales', 'software a medida'],
```

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "fix(seo): replace tech-stack keywords with business-facing terms"
```

---

## Task 5: M1+M2 — Reparar Organization schema (sameAs y SearchAction)

**Problema 1 (M1):** `sameAs: ["https://pixeltec.mx"]` apunta al mismo sitio — no aporta señal de entidad a Google.

**Problema 2 (M2):** `SearchAction` apunta a `/blog?q=` que no existe. Google puede marcar el schema como inválido al validarlo.

**Archivos:**
- Modify: `src/components/seo/structured-data.tsx`

- [ ] **Step 1: Localizar los campos problemáticos**

```bash
grep -n "sameAs\|SearchAction\|potentialAction" src/components/seo/structured-data.tsx
```

- [ ] **Step 2: Actualizar el objeto organizationSchema**

En `src/components/seo/structured-data.tsx`, dentro de `organizationSchema`, reemplazar el campo `sameAs`:

```tsx
// Antes:
sameAs: ["https://pixeltec.mx"],

// Después — sustituir por los perfiles reales de PIXELTEC:
sameAs: [
  "https://www.linkedin.com/company/pixeltec-mx",
  // agregar GitHub, directorios empresariales u otras URLs verificadas si existen
],
```

> **Nota para executor:** Confirmar con Miguel cuáles perfiles/URLs son los correctos antes de hacer el commit. Si no hay perfiles sociales verificados aún, eliminar el campo `sameAs` completamente en lugar de dejar un placeholder.

- [ ] **Step 3: Eliminar el potentialAction de webSiteSchema**

En el mismo archivo, dentro de `webSiteSchema`, eliminar el bloque `potentialAction` completo:

```tsx
// Antes:
const webSiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "PixelTEC",
  url: "https://pixeltec.mx",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://pixeltec.mx/blog?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

// Después:
const webSiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "PixelTEC",
  url: "https://pixeltec.mx",
};
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/components/seo/structured-data.tsx
git commit -m "fix(seo): repair Organization schema — real sameAs, remove broken SearchAction

SearchAction target /blog?q= does not exist — removed to prevent schema validation errors.
sameAs updated with real social profiles."
```

---

## Task 6: O2 — Agregar dateModified a BlogPosting schema

**Problema:** El schema `BlogPosting` solo tiene `datePublished`. Google usa `dateModified` para determinar la frescura del contenido.

**Archivos:**
- Modify: `src/components/seo/structured-data.tsx`

- [ ] **Step 1: Agregar dateModified al prop interface**

En `src/components/seo/structured-data.tsx`, actualizar la interface `BlogPostingSchemaProps`:

```tsx
// Antes:
interface BlogPostingSchemaProps {
  slug: string;
  title: string;
  excerpt: string;
  datePublished: string;
  author: string;
  imageUrl: string;
}

// Después:
interface BlogPostingSchemaProps {
  slug: string;
  title: string;
  excerpt: string;
  datePublished: string;
  dateModified?: string;
  author: string;
  imageUrl: string;
}
```

- [ ] **Step 2: Agregar dateModified al schema object**

En la función `BlogPostingStructuredData`, actualizar el schema:

```tsx
// Antes:
const schema = {
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: title,
  description: excerpt,
  url: `https://pixeltec.mx/blog/${slug}`,
  datePublished,
  author: { ...

// Después:
const schema = {
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: title,
  description: excerpt,
  url: `https://pixeltec.mx/blog/${slug}`,
  datePublished,
  dateModified: dateModified ?? datePublished,
  author: { ...
```

- [ ] **Step 3: Actualizar las llamadas en blog/[slug]/page.tsx**

En `src/app/blog/[slug]/page.tsx`, en la llamada con el post de Firestore (línea ~82):

```tsx
// Antes:
<BlogPostingStructuredData
  slug={firestorePost.slug}
  title={firestorePost.title}
  excerpt={firestorePost.excerpt}
  datePublished={firestorePost.publishedAt ?? firestorePost.createdAt}
  author={firestorePost.author.name}
  imageUrl={firestorePost.coverImage ?? ''}
/>

// Después:
<BlogPostingStructuredData
  slug={firestorePost.slug}
  title={firestorePost.title}
  excerpt={firestorePost.excerpt}
  datePublished={firestorePost.publishedAt ?? firestorePost.createdAt}
  dateModified={firestorePost.updatedAt ?? firestorePost.publishedAt ?? firestorePost.createdAt}
  author={firestorePost.author.name}
  imageUrl={firestorePost.coverImage ?? ''}
/>
```

La llamada con `blogPosts` estáticos no necesita cambio — `dateModified` es opcional y usará `datePublished` como fallback.

- [ ] **Step 4: Verificar TypeScript**

```bash
npm run typecheck
```
Expected: sin errores. Si el tipo de `firestorePost.updatedAt` no es `string`, ajustar con `.toString()` o el mismo cast que ya usa `publishedAt`.

- [ ] **Step 5: Commit**

```bash
git add src/components/seo/structured-data.tsx src/app/blog/[slug]/page.tsx
git commit -m "fix(seo): add dateModified to BlogPosting schema

Firestore posts pass updatedAt ?? publishedAt.
Static fallback posts use datePublished as dateModified."
```

---

## Task 7: M4+M5 — Mejorar sitemap.ts

**Problema 1 (M4):** `/guias-transformacion` no está en `staticRoutes`.

**Problema 2 (M5):** Todas las páginas estáticas usan `lastModified: now` (fecha del request), lo que impide que Google entienda cuándo cambió realmente el contenido.

**Archivos:**
- Modify: `src/app/sitemap.ts`

- [ ] **Step 1: Verificar el estado actual**

```bash
grep -n "guias\|lastModified\|now" src/app/sitemap.ts
```
Expected: `now` aparece en todas las rutas estáticas y `/guias-transformacion` no aparece.

- [ ] **Step 2: Reemplazar el bloque staticRoutes**

En `src/app/sitemap.ts`, reemplazar el array `staticRoutes` completo con fechas fijas y la ruta faltante:

```tsx
const staticRoutes: MetadataRoute.Sitemap = [
  { url: BASE_URL,                                lastModified: new Date('2026-06-16'), changeFrequency: "weekly",  priority: 1.0 },
  { url: `${BASE_URL}/services`,                  lastModified: new Date('2026-06-16'), changeFrequency: "monthly", priority: 0.9 },
  { url: `${BASE_URL}/blog`,                      lastModified: new Date('2026-06-16'), changeFrequency: "weekly",  priority: 0.8 },
  { url: `${BASE_URL}/industrias`,                lastModified: new Date('2026-06-16'), changeFrequency: "monthly", priority: 0.7 },
  { url: `${BASE_URL}/about`,                     lastModified: new Date('2026-06-16'), changeFrequency: "monthly", priority: 0.7 },
  { url: `${BASE_URL}/equipo`,                    lastModified: new Date('2026-06-16'), changeFrequency: "monthly", priority: 0.6 },
  { url: `${BASE_URL}/contact`,                   lastModified: new Date('2026-06-16'), changeFrequency: "monthly", priority: 0.6 },
  { url: `${BASE_URL}/metodologia`,               lastModified: new Date('2026-06-16'), changeFrequency: "monthly", priority: 0.6 },
  { url: `${BASE_URL}/guias-transformacion`,      lastModified: new Date('2026-06-16'), changeFrequency: "monthly", priority: 0.5 },
  { url: `${BASE_URL}/aviso-de-privacidad`,       lastModified: new Date('2026-04-01'), changeFrequency: "yearly",  priority: 0.3 },
  { url: `${BASE_URL}/terminos-de-servicio`,      lastModified: new Date('2026-04-01'), changeFrequency: "yearly",  priority: 0.3 },
  { url: `${BASE_URL}/data-deletion`,             lastModified: new Date('2026-04-01'), changeFrequency: "yearly",  priority: 0.2 },
];
```

> **Nota:** También eliminar la línea `const now = new Date();` (ya no se usa).

- [ ] **Step 3: Verificar TypeScript**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/app/sitemap.ts
git commit -m "fix(seo): add /guias-transformacion to sitemap, use fixed lastModified dates

Dynamic now() on every static page prevented Google from tracking real content changes."
```

---

## Task 8: O3+O5 — Añadir rutas privadas a robots.txt

**Problema:** `/login`, `/portal` y `/blog-admin` no están en la lista `disallow` de `robots.ts`. Son accesibles por crawlers aunque estén protegidas por auth.

**Archivos:**
- Modify: `src/app/robots.ts`

- [ ] **Step 1: Ver el estado actual**

```bash
cat src/app/robots.ts
```

- [ ] **Step 2: Actualizar el array disallow**

```tsx
// Antes:
disallow: [
  "/perfil",
  "/notificaciones",
  "/dashboard",
  "/asistente",
  "/clientes",
  "/proyectos",
  "/herramientas",
  "/vps",
  "/crypto-intel",
  "/api/",
],

// Después:
disallow: [
  "/login",
  "/portal",
  "/blog-admin",
  "/perfil",
  "/notificaciones",
  "/dashboard",
  "/asistente",
  "/clientes",
  "/proyectos",
  "/herramientas",
  "/vps",
  "/crypto-intel",
  "/api/",
],
```

- [ ] **Step 3: Commit**

```bash
git add src/app/robots.ts
git commit -m "fix(seo): disallow /login, /portal and /blog-admin in robots.txt"
```

---

## Task 9: M6 — Favicon, apple-touch-icon y theme-color

**Problema:** Solo existe el `favicon.ico` default. Sin `apple-touch-icon` el sitio se ve mal al guardarse en pantalla de inicio iOS. Sin `themeColor` la barra del navegador móvil queda blanca.

**Archivos:**
- Modify: `src/app/layout.tsx`

> **Nota:** Next.js 15 detecta automáticamente `src/app/icon.png` (512×512) y `src/app/apple-icon.png` (180×180) si se colocan en esa carpeta. La opción más simple sin crear imágenes nuevas es apuntar a `ptlogox.png` existente (7.2 KB, pero necesitamos conocer sus dimensiones).

- [ ] **Step 1: Verificar dimensiones del logo actual**

```bash
identify public/ptlogox.png 2>/dev/null || file public/ptlogox.png
```

- [ ] **Step 2: Agregar icons y themeColor al metadata root**

En `src/app/layout.tsx`, dentro del objeto `metadata`, agregar después del campo `authors`:

```tsx
icons: {
  icon: '/ptlogox.png',
  shortcut: '/ptlogox.png',
  apple: '/ptlogox.png',
},
```

Y agregar en el `<html>` tag o como campo adicional de metadata:

```tsx
// En el return de RootLayout, agregar en <head> vía Next.js metadata:
// Agregar al objeto metadata en layout.tsx:
other: {
  'theme-color': '#030303',
},
```

> **Nota ideal:** Si Miguel puede exportar el logo como PNG 512×512 con fondo transparente y colocarlo en `src/app/icon.png`, Next.js lo detecta automáticamente y sirve todos los tamaños de favicon. En ese caso eliminar la sección `icons` manual.

- [ ] **Step 3: Verificar TypeScript**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "fix(seo): add apple-touch-icon and theme-color to root metadata"
```

---

## Task 10: O1 — BreadcrumbList schema en blog y servicios

**Problema:** Las subpáginas de blog (`/blog/[slug]`) y servicios (`/services/[slug]`) no tienen breadcrumbs en los resultados de Google. Los rich snippets de breadcrumb aumentan el CTR (click-through rate).

**Archivos:**
- Modify: `src/components/seo/structured-data.tsx`
- Modify: `src/app/blog/[slug]/page.tsx`
- Modify: `src/app/services/[slug]/page.tsx`

- [ ] **Step 1: Agregar BreadcrumbStructuredData al archivo de schemas**

En `src/components/seo/structured-data.tsx`, agregar al final del archivo:

```tsx
interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbSchemaProps {
  items: BreadcrumbItem[]; // en orden: [Home, Sección, Página]
}

export function BreadcrumbStructuredData({ items }: BreadcrumbSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

- [ ] **Step 2: Usar BreadcrumbStructuredData en blog/[slug]/page.tsx**

En `src/app/blog/[slug]/page.tsx`, importar el nuevo componente y agregarlo al return del post de Firestore y del post estático:

```tsx
// Agregar al import:
import { BlogPostingStructuredData, BreadcrumbStructuredData } from '@/components/seo/structured-data';

// En el return del post de Firestore (antes de BlogPostFirestoreClient):
return (
  <>
    <BreadcrumbStructuredData items={[
      { name: 'PixelTEC', url: 'https://pixeltec.mx' },
      { name: 'Blog', url: 'https://pixeltec.mx/blog' },
      { name: firestorePost.title, url: `https://pixeltec.mx/blog/${firestorePost.slug}` },
    ]} />
    <BlogPostingStructuredData ... />
    <BlogPostFirestoreClient post={firestorePost} />
  </>
);

// En el return del post estático (antes de BlogPostClient):
return (
  <>
    <BreadcrumbStructuredData items={[
      { name: 'PixelTEC', url: 'https://pixeltec.mx' },
      { name: 'Blog', url: 'https://pixeltec.mx/blog' },
      { name: post.title, url: `https://pixeltec.mx/blog/${post.slug}` },
    ]} />
    <BlogPostingStructuredData ... />
    <BlogPostClient post={post} />
  </>
);
```

- [ ] **Step 3: Usar BreadcrumbStructuredData en services/[slug]/page.tsx**

En `src/app/services/[slug]/page.tsx`, el componente `ServiceDetailClient` es client-side. El breadcrumb va en el Server Component padre:

```tsx
// Agregar import:
import { BreadcrumbStructuredData, ServiceStructuredData } from '@/components/seo/structured-data';

// En el return:
export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SERVICE_META[slug]) notFound();
  const meta = SERVICE_META[slug];
  return (
    <>
      <BreadcrumbStructuredData items={[
        { name: 'PixelTEC', url: 'https://pixeltec.mx' },
        { name: 'Servicios', url: 'https://pixeltec.mx/services' },
        { name: meta.title, url: `https://pixeltec.mx/services/${slug}` },
      ]} />
      <ServiceStructuredData slug={slug} title={meta.title} description={meta.description} />
      <ServiceDetailClient slug={slug} />
    </>
  );
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npm run typecheck
```
Expected: sin errores. Si `ServiceStructuredData` ya se importa en otro lugar, verificar que no haya import duplicado.

- [ ] **Step 5: Commit**

```bash
git add src/components/seo/structured-data.tsx \
        src/app/blog/[slug]/page.tsx \
        src/app/services/[slug]/page.tsx
git commit -m "feat(seo): add BreadcrumbList schema to blog posts and service pages

Enables breadcrumb rich snippets in Google search results.
Increases CTR by showing full path below the title."
```

---

## Verificación final

- [ ] **Build limpio:**

```bash
npm run build 2>&1 | tail -20
```
Expected: sin errores. Puede haber warnings de `img` vs `Image` de Next.js — ignorar si pre-existían.

- [ ] **Verificar metadata renderizado en HTML del servidor:**

```bash
curl -s --compressed https://pixeltec.mx/ | grep -A2 'application/ld+json\|og:title\|canonical'
```
Expected: los scripts JSON-LD aparecen en el HTML crudo (no requieren JS).

- [ ] **Verificar robots.txt actualizado:**

```bash
curl -s https://pixeltec.mx/robots.txt
```
Expected: `/login`, `/portal` y `/blog-admin` en Disallow.

- [ ] **Verificar sitemap.xml:**

```bash
curl -s https://pixeltec.mx/sitemap.xml | grep -o '<loc>[^<]*</loc>' | sort
```
Expected: incluye `/guias-transformacion`. Todas las URLs de admin ausentes.

---

## Resumen de commits esperados

| Task | Commit | Impacto |
|---|---|---|
| T1 | `fix(seo): make structured-data a Server Component` | Crítico |
| T2 | `perf(seo): migrate blog from force-dynamic to ISR` | Crítico |
| T3 | `fix(seo): add canonical+OG metadata to remaining public pages` | Crítico |
| T4 | `fix(seo): replace tech-stack keywords with business-facing terms` | Bajo |
| T5 | `fix(seo): repair Organization schema` | Medio |
| T6 | `fix(seo): add dateModified to BlogPosting schema` | Bajo |
| T7 | `fix(seo): guias-transformacion in sitemap + fixed lastModified dates` | Medio |
| T8 | `fix(seo): disallow login/portal/blog-admin in robots` | Bajo |
| T9 | `fix(seo): apple-touch-icon and theme-color` | Bajo |
| T10 | `feat(seo): BreadcrumbList schema in blog and services` | Medio |
