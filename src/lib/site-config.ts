/**
 * Fuente única de identidad del sitio (WS0 — SEO integral).
 *
 * Antes de este módulo, la marca, la URL base y el NAP vivían duplicados en
 * ~20 archivos con variantes divergentes ("PIXELTEC" vs "PixelTEC", tres
 * formatos de teléfono, redes solo en el footer). Todo dato de identidad
 * pública nuevo se declara AQUÍ y se consume tipado; los literales restantes
 * en UI/emails se migran de forma incremental (deuda registrada en
 * docs/seo/SEO-ARCHITECTURE.md).
 */

export const SITE = {
  /** Marca canónica única — decisión WS1: "PixelTEC" (la variante en
   *  mayúsculas del JSON-LD de Organization era inconsistente con el
   *  title template, el OG siteName y el sitio visible). */
  name: 'PixelTEC',
  url: 'https://pixeltec.mx',
  description:
    'Transformamos procesos complejos en ecosistemas web y automatizaciones escalables para empresas que buscan rentabilidad y control absoluto.',
  locale: 'es-MX',
  ogLocale: 'es_MX',
  logoPath: '/ptlogox.png',
  defaultOgImage: '/og-image.png',
  email: 'contacto@pixeltec.mx',
  phone: {
    /** Formato schema.org / tel: */
    e164: '+523221378336',
    schema: '+52-322-137-8336',
    display: '+52 (322) 137-8336',
  },
  address: {
    locality: 'Puerto Vallarta',
    region: 'Jalisco',
    country: 'MX',
  },
  founder: 'Miguel Robles Sánchez',
  /** Solo perfiles oficiales VERIFICADOS (los mismos que enlaza el footer).
   *  Agregar aquí = aparece en `sameAs` de Organization. */
  socialProfiles: [
    'https://www.facebook.com/profile.php?id=61556300117500',
    'https://instagram.com/pixeltecmx',
  ],
} as const;

/** URL absoluta canónica para un path del sitio. */
export function absoluteUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${SITE.url}${path.startsWith('/') ? path : `/${path}`}`;
}
