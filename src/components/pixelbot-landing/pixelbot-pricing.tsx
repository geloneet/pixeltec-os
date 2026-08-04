import { CheckCircle2, XCircle } from 'lucide-react';
import { ShinyButton } from '@/components/ui/shiny-button';
import { PACKAGES, PRICING_INTRO } from './pixelbot-content';

const chip = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium';

/**
 * 4 tarjetas de paquetes comerciales (server component). Reutiliza los
 * mismos tokens Tailwind/shadcn del resto de la landing: card con borde de
 * acento (pixelbot-comparison.tsx) para el plan destacado y chip pill
 * (pixelbot-console-showcase.tsx) para el badge "Más elegido", con texto
 * visible además de color para accesibilidad.
 */
export function PixelbotPricing() {
  return (
    <section id="planes" className="py-14 sm:py-20 scroll-mt-28">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground [text-wrap:balance]">
          {PRICING_INTRO.title}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-base sm:text-lg text-muted-foreground leading-relaxed">
          {PRICING_INTRO.intro}
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {PACKAGES.map((pkg) => (
            <article
              key={pkg.id}
              className={
                pkg.badge
                  ? 'relative flex flex-col rounded-2xl border-2 border-primary dark:border-cyan-500 bg-card p-6 shadow-sm dark:shadow-[0_0_40px_rgba(34,211,238,0.08)]'
                  : 'relative flex flex-col rounded-2xl border border-border bg-card p-6'
              }
            >
              {pkg.badge && (
                <span
                  aria-label={`Plan recomendado: ${pkg.badge}`}
                  className={`${chip} absolute -top-3 left-1/2 -translate-x-1/2 border border-primary bg-primary text-primary-foreground dark:border-cyan-500 dark:bg-cyan-500 dark:text-black`}
                >
                  {pkg.badge}
                </span>
              )}

              <h3 className="text-lg font-semibold text-foreground">{pkg.name}</h3>
              <p className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">{pkg.price}</p>
              {pkg.priceNote && <p className="mt-1 text-xs text-muted-foreground">{pkg.priceNote}</p>}
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{pkg.forWhom}</p>

              {pkg.includesIntro && (
                <p className="mt-4 text-xs font-medium text-foreground/70">{pkg.includesIntro}</p>
              )}
              <ul className="mt-4 flex-1 space-y-2">
                {pkg.includes.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-foreground/80">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary dark:text-cyan-400"
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {pkg.excludes && pkg.excludes.length > 0 && (
                <ul className="mt-4 space-y-2 border-t border-border pt-4">
                  {pkg.excludes.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <XCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}

              <ShinyButton href="#diagnostico" className="mt-6 w-full">
                {pkg.cta}
              </ShinyButton>
            </article>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-3xl text-center text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {PRICING_INTRO.note}
        </p>
      </div>
    </section>
  );
}
