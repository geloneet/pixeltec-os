import { CheckCircle2, XCircle } from 'lucide-react';
import { COMPARISON, FIT, USE_CASES } from './pixelbot-content';

/** Comparativa (tabla accesible) + casos de uso + fit/no-fit (server). */
export function PixelbotComparison() {
  return (
    <>
      {/* Comparativa */}
      <section className="py-14 sm:py-20">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            {COMPARISON.title}
          </h2>
          <div className="mt-10 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <caption className="sr-only">{COMPARISON.caption}</caption>
              <thead>
                <tr className="border-b border-border bg-muted/50 dark:bg-white/5">
                  {COMPARISON.columns.map((col, i) => (
                    <th
                      key={col}
                      scope="col"
                      className={
                        i === 3
                          ? 'px-4 py-3.5 text-left font-semibold text-primary dark:text-cyan-400 bg-primary/5 dark:bg-cyan-500/5'
                          : 'px-4 py-3.5 text-left font-semibold text-foreground'
                      }
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.rows.map((row) => (
                  <tr key={row[0]} className="border-b border-border last:border-b-0">
                    <th scope="row" className="px-4 py-3.5 text-left font-medium text-foreground">
                      {row[0]}
                    </th>
                    <td className="px-4 py-3.5 text-muted-foreground">{row[1]}</td>
                    <td className="px-4 py-3.5 text-muted-foreground">{row[2]}</td>
                    <td className="px-4 py-3.5 font-medium text-foreground bg-primary/5 dark:bg-cyan-500/5">
                      {row[3]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Casos de uso */}
      <section className="py-14 sm:py-20">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            {USE_CASES.title}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-base sm:text-lg text-muted-foreground">
            {USE_CASES.intro}
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {USE_CASES.items.map((item) => (
              <article
                key={item.title}
                className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/25 dark:hover:border-cyan-500/25"
              >
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Fit / no-fit */}
      <section className="py-14 sm:py-20">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            {FIT.title}
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-primary/20 dark:border-cyan-500/20 bg-primary/5 dark:bg-cyan-500/5 p-6 sm:p-8">
              <h3 className="text-lg font-semibold text-foreground">{FIT.yesTitle}</h3>
              <ul className="mt-4 space-y-3">
                {FIT.yes.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary dark:text-cyan-400" aria-hidden="true" />
                    <p className="text-sm sm:text-[15px] text-foreground/85 leading-relaxed">{item}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
              <h3 className="text-lg font-semibold text-foreground">{FIT.noTitle}</h3>
              <ul className="mt-4 space-y-3">
                {FIT.no.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                    <p className="text-sm sm:text-[15px] text-muted-foreground leading-relaxed">{item}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
