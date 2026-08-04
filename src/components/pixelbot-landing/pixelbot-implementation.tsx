import { Check, ClipboardList, Info } from 'lucide-react';
import { COMPLIANCE, IMPLEMENTATION, PRICING } from './pixelbot-content';

/** Proceso de implementación, qué incluye/necesita, costo y compliance (server). */
export function PixelbotImplementation() {
  return (
    <section className="py-14 sm:py-20">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
          {IMPLEMENTATION.title}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-base sm:text-lg text-muted-foreground">
          {IMPLEMENTATION.intro}
        </p>

        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {IMPLEMENTATION.steps.map((step, index) => (
            <li key={step.title} className="relative overflow-hidden rounded-xl border border-border bg-card p-6">
              <span
                aria-hidden="true"
                className="absolute -top-3 -right-2 text-7xl font-extrabold text-primary/5 dark:text-cyan-500/5 select-none"
              >
                {`0${index + 1}`}
              </span>
              <h3 className="relative z-10 font-semibold text-foreground">{step.title}</h3>
              <p className="relative z-10 mt-2 text-sm text-muted-foreground leading-relaxed">{step.detail}</p>
            </li>
          ))}
        </ol>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Check className="h-5 w-5 text-primary dark:text-cyan-400" aria-hidden="true" />
              {IMPLEMENTATION.includesTitle}
            </h3>
            <ul className="mt-4 grid gap-2.5">
              {IMPLEMENTATION.includes.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-foreground/80">
                  <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/60 dark:bg-cyan-500/60" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <ClipboardList className="h-5 w-5 text-primary dark:text-cyan-400" aria-hidden="true" />
              {IMPLEMENTATION.needsTitle}
            </h3>
            <ul className="mt-4 grid gap-2.5">
              {IMPLEMENTATION.needs.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-foreground/80">
                  <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/60 dark:bg-cyan-500/60" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Activación estándar vs. a la medida (los 4 planes con precio viven en PixelbotPricing) */}
        <div className="mt-12 rounded-2xl border border-border bg-gradient-to-tr from-primary/5 via-card to-card dark:from-cyan-950/40 dark:via-[#0A0A0A] dark:to-[#0A0A0A] p-8 sm:p-10 text-center">
          <h3 className="text-xl sm:text-2xl font-bold text-foreground">{PRICING.title}</h3>
          <p className="mx-auto mt-4 max-w-3xl text-sm sm:text-base text-muted-foreground leading-relaxed">
            {PRICING.body}
          </p>
        </div>

        {/* Compliance WhatsApp */}
        <div className="mt-6 rounded-2xl border border-border bg-card/60 p-6 sm:p-8">
          <h3 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
            <Info className="h-5 w-5 text-primary dark:text-cyan-400" aria-hidden="true" />
            {COMPLIANCE.title}
          </h3>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {COMPLIANCE.items.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
                <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-muted-foreground/50" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
