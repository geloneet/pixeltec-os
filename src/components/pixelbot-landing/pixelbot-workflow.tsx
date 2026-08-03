import { CircleAlert } from 'lucide-react';
import { PAIN, WORKFLOW } from './pixelbot-content';

/** Dolor + flujo continuo de 6 pasos (server component, sin JS de cliente). */
export function PixelbotWorkflow() {
  return (
    <>
      {/* Dolor */}
      <section className="py-14 sm:py-20">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground [text-wrap:balance]">
            {PAIN.title}
          </h2>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2">
            {PAIN.items.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-xl border border-border bg-card/60 px-5 py-4"
              >
                <CircleAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm sm:text-base text-foreground/80 leading-relaxed">{item}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Flujo */}
      <section id="como-funciona" className="py-14 sm:py-20 scroll-mt-28">
        <div className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            {WORKFLOW.title}
          </h2>
          <ol className="relative mt-12 space-y-0 border-s-2 border-border ms-4 sm:ms-6">
            {WORKFLOW.steps.map((step, index) => (
              <li key={step.title} className="relative ps-8 sm:ps-10 pb-10 last:pb-0">
                <span
                  aria-hidden="true"
                  className="absolute -start-[13px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-primary/60 bg-background text-[11px] font-bold text-primary dark:border-cyan-500/60 dark:text-cyan-400"
                >
                  {index + 1}
                </span>
                <h3 className="text-base sm:text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="mt-1 text-sm sm:text-base text-muted-foreground leading-relaxed">{step.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
