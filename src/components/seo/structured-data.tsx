const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "PIXELTEC",
  url: "https://pixeltec.mx",
  logo: "https://pixeltec.mx/ptlogox.png",
  description:
    "Transformamos procesos complejos en ecosistemas web y automatizaciones escalables para empresas que buscan rentabilidad y control absoluto.",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Puerto Vallarta",
    addressRegion: "Jalisco",
    addressCountry: "MX",
  },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+52-322-137-8336",
    email: "contacto@pixeltec.mx",
    contactType: "sales",
  },
  founder: {
    "@type": "Person",
    name: "Miguel Robles Sánchez",
  },
};

const webSiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "PixelTEC",
  url: "https://pixeltec.mx",
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
    url: `https://pixeltec.mx/services/${slug}`,
    provider: {
      "@type": "Organization",
      name: "PIXELTEC",
      url: "https://pixeltec.mx",
    },
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
    url: `https://pixeltec.mx/blog/${slug}`,
    datePublished,
    dateModified: dateModified ?? datePublished,
    author: {
      "@type": "Person",
      name: author,
    },
    publisher: {
      "@type": "Organization",
      name: "PIXELTEC",
      logo: {
        "@type": "ImageObject",
        url: "https://pixeltec.mx/ptlogox.png",
      },
    },
    image: imageUrl,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://pixeltec.mx/blog/${slug}`,
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
