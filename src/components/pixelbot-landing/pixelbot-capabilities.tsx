import { CAPABILITIES } from './pixelbot-content';

/** Seis capacidades agrupadas por resultado de negocio (server component). */
export function PixelbotCapabilities() {
  return (
    <section className="py-14 sm:py-20">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
          {CAPABILITIES.title}
        </h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.items.map((item) => (
            <article key={item.title} className="bg-card p-6 sm:p-8">
              <span aria-hidden="true" className="block h-1 w-10 rounded-full bg-primary/70 dark:bg-cyan-500/70" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm sm:text-[15px] text-muted-foreground leading-relaxed">{item.detail}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
