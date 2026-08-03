import { SITE, absoluteUrl } from '@/lib/site-config';

/**
 * JSON-LD del sitio — Server Components puros (sin "use client": los crawlers
 * de redes sociales no ejecutan JS). Identidad y NAP salen de `site-config`
 * (WS0): una sola marca ("PixelTEC"), un solo logo, un solo teléfono.
 * `@id` enlaza Organization ↔ WebSite ↔ publisher para que Google entienda
 * que son la misma entidad.
 */

const ORG_ID = `${SITE.url}/#organization`;

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": ORG_ID,
  name: SITE.name,
  url: SITE.url,
  logo: absoluteUrl(SITE.logoPath),
  description: SITE.description,
  email: SITE.email,
  address: {
    "@type": "PostalAddress",
    addressLocality: SITE.address.locality,
    addressRegion: SITE.address.region,
    addressCountry: SITE.address.country,
  },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: SITE.phone.schema,
    email: SITE.email,
    contactType: "sales",
    areaServed: "MX",
    availableLanguage: ["es"],
  },
  founder: {
    "@type": "Person",
    name: SITE.founder,
  },
  sameAs: SITE.socialProfiles,
};

const webSiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE.name,
  url: SITE.url,
  inLanguage: SITE.locale,
  publisher: { "@id": ORG_ID },
};

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

interface ServiceSchemaProps {
  slug: string;
  title: string;
  description: string;
}

export function ServiceStructuredData({ slug, title, description }: ServiceSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: title,
    description,
    url: absoluteUrl(`/services/${slug}`),
    provider: { "@id": ORG_ID },
    areaServed: {
      "@type": "Country",
      name: "Mexico",
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface BlogPostingSchemaProps {
  slug: string;
  title: string;
  excerpt: string;
  datePublished: string;
  dateModified?: string;
  author: string;
  imageUrl: string;
}

export function BlogPostingStructuredData({
  slug,
  title,
  excerpt,
  datePublished,
  dateModified,
  author,
  imageUrl,
}: BlogPostingSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description: excerpt,
    url: absoluteUrl(`/blog/${slug}`),
    inLanguage: SITE.locale,
    datePublished,
    dateModified: dateModified ?? datePublished,
    author: {
      "@type": "Person",
      name: author,
    },
    publisher: {
      "@type": "Organization",
      "@id": ORG_ID,
      name: SITE.name,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl(SITE.logoPath),
      },
    },
    image: imageUrl,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": absoluteUrl(`/blog/${slug}`),
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// Variante de Service para páginas de producto fuera de /services/[slug]
// (ServiceStructuredData hardcodea ese prefijo en su URL).
interface StandaloneServiceSchemaProps {
  url: string;
  name: string;
  description: string;
}

export function StandaloneServiceStructuredData({ url, name, description }: StandaloneServiceSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    description,
    url,
    provider: { "@id": ORG_ID },
    areaServed: {
      "@type": "Country",
      name: "Mexico",
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface FaqPageItem {
  q: string;
  a: string;
}

// FAQPage: usar ÚNICAMENTE con preguntas/respuestas idénticas al texto visible
// de la página que lo emite (requisito de Google para rich results).
export function FAQPageStructuredData({ items }: { items: readonly FaqPageItem[] }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbSchemaProps {
  items: BreadcrumbItem[];
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

// Listado del blog (/blog): identifica la página como colección de artículos
// de la Organization — complementa los BlogPosting individuales.
export function CollectionPageStructuredData({
  name,
  description,
  path,
}: {
  name: string;
  description: string;
  path: string;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url: absoluteUrl(path),
    inLanguage: SITE.locale,
    isPartOf: { "@type": "WebSite", url: SITE.url, name: SITE.name },
    publisher: { "@id": ORG_ID },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
