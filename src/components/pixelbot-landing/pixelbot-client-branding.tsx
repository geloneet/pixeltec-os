import { BRAND_IDENTITY } from './pixelbot-content';

/**
 * Identidad conversacional elegida por el cliente: nombre, tono y forma de
 * presentarse del bot. Los ejemplos son ilustrativos (nunca clientes reales)
 * y el caveat de Meta se muestra siempre en texto visible, no en tooltip.
 */
export function PixelbotClientBranding() {
  return (
    <section className="py-14 sm:py-20">
      <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground [text-wrap:balance]">
          {BRAND_IDENTITY.title}
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
          {BRAND_IDENTITY.body}
        </p>

        <p className="mt-8 text-sm font-medium text-foreground/70">{BRAND_IDENTITY.examplesLabel}</p>
        <ul className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {BRAND_IDENTITY.examples.map((example) => (
            <li
              key={example}
              className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1.5 text-sm font-medium text-primary dark:border-cyan-500/25 dark:bg-cyan-500/10 dark:text-cyan-400"
            >
              {example}
            </li>
          ))}
        </ul>

        <p className="mx-auto mt-8 max-w-2xl rounded-xl border border-border bg-muted/40 dark:bg-white/5 px-5 py-4 text-sm text-muted-foreground leading-relaxed">
          {BRAND_IDENTITY.metaCaveat}
        </p>
      </div>
    </section>
  );
}
