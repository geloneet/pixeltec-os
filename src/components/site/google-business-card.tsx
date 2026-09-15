import { SITE } from '@/lib/site-config';

/**
 * Tarjeta de la ficha de Google Business Profile (WO-2026-00346, L6).
 * Patrón de `gmb-card.tsx` de Muebles Encino (mapa embebido + nombre +
 * «Ver ficha en Google →»), SIN calificación ni reseñas: PixelTEC no tiene
 * datos verificados de reseñas y no se inventa nada.
 *
 * El iframe carga `lazy` y va lejos del primer pliegue (cierre del artículo,
 * columna de datos de contacto), así que no toca el LCP. `embedUrl` resuelve
 * la ficha por CID (ver `site-config`); la CSP ya permite
 * `frame-src https://www.google.com`.
 */
const gbp = SITE.googleBusinessProfile;

export function GoogleBusinessCard({ className = '' }: { className?: string }) {
  return (
    <section
      aria-labelledby="google-business-heading"
      className={`overflow-hidden rounded-2xl border border-border bg-card dark:bg-white/[0.03] ${className}`}
    >
      <iframe
        src={gbp.embedUrl}
        title={`Ubicación de ${gbp.name} en Google Maps`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
        className="block h-44 w-full border-0"
      />
      <div className="p-5">
        <h3 id="google-business-heading" className="text-sm font-semibold leading-snug text-foreground dark:text-white">
          {gbp.name} en Google
        </h3>
        <p className="mt-1 text-sm text-muted-foreground dark:text-zinc-400">
          {SITE.address.locality}, {SITE.address.region}, México · {SITE.phone.display}
        </p>
        <a
          href={gbp.url}
          target="_blank"
          rel="noreferrer"
          data-cta="google_business"
          data-cta-pos="gbp_card"
          className="mt-3 inline-block text-sm font-medium text-brand underline-offset-4 hover:underline"
        >
          Ver ficha en Google →
        </a>
      </div>
    </section>
  );
}
