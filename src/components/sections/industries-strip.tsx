import Link from 'next/link';
import { Truck, Droplets, Stethoscope, Hotel, ShoppingBag, Sun, ArrowRight, type LucideIcon } from 'lucide-react';
import { INDUSTRIES, industryPagePath, type IndustryIcon } from '@/lib/content/industrias';

/**
 * Prueba social sectorial. Cada sector está respaldado por al menos un cliente
 * real documentado (registro `@/lib/content/industrias`, WO-2026-00345 L2); no
 * se muestran logos (no hay activos ni autorización) ni métricas. Tipografía +
 * iconografía ligera, deliberadamente sin cuadrícula de tarjetas, para romper
 * el patrón de las secciones vecinas. Los sectores con página propia se
 * enlazan; el resto sigue siendo texto.
 */
const ICONS: Record<IndustryIcon, LucideIcon> = { Truck, Droplets, Stethoscope, Hotel, ShoppingBag, Sun };

const LABEL = 'text-sm text-muted-foreground md:text-base';

export default function IndustriesStrip() {
  return (
    <section aria-labelledby="industries-heading" className="bg-transparent py-14 md:py-16">
      <div className="container mx-auto max-w-5xl px-4 md:px-6">
        <h2
          id="industries-heading"
          className="text-center text-xl font-semibold tracking-tight text-foreground md:text-2xl"
        >
          Operamos dentro de industrias reales, no de casos hipotéticos
        </h2>

        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-4 md:gap-x-8">
          {INDUSTRIES.map((industry) => {
            const Icon = ICONS[industry.icon];
            return (
              <li key={industry.slug} className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                {industry.page ? (
                  <Link
                    href={industryPagePath(industry.page)}
                    className={`${LABEL} underline-offset-4 transition-colors hover:text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus`}
                  >
                    {industry.shortLabel}
                  </Link>
                ) : (
                  <span className={LABEL}>{industry.shortLabel}</span>
                )}
              </li>
            );
          })}
        </ul>

        <p className="mt-8 text-center">
          <Link
            href="/industrias"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand underline-offset-4 transition-colors hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
          >
            Ver cómo trabajamos en cada industria
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </p>
      </div>
    </section>
  );
}
