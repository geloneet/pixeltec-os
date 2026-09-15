import Link from 'next/link';
import { getHomeGuideLinks, getHomeLandingGroups } from '@/lib/content/home-landings';

/**
 * Presencia local + guías (WO-2026-00343). Server Component sin animación: los
 * 18 enlaces a landings tienen que viajar en el HTML inicial (REN-01) y son la
 * ruta por la que la portada reparte autoridad a las páginas de ciudad y de
 * keyword, que hasta ahora solo colgaban del sitemap.
 *
 * Reutiliza el chip de «… en tu ciudad» de /services/[slug] (mismas clases) y
 * repite su misma afirmación de cobertura: no se declara presencia nueva.
 */
const CHIP =
  'inline-flex min-h-11 items-center rounded-full border border-primary/25 dark:border-cyan-500/25 bg-primary/5 dark:bg-cyan-500/5 px-4 py-2 text-sm font-medium text-brand hover:bg-primary/10 dark:hover:bg-cyan-500/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

export function LocalLandingsSection() {
  const groups = getHomeLandingGroups();
  const guides = getHomeGuideLinks();

  return (
    <section aria-labelledby="local-landings-heading" className="py-16 sm:py-20">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-brand">Presencia local</span>
        <h2
          id="local-landings-heading"
          className="mt-3 text-2xl font-semibold tracking-tight text-foreground dark:text-white md:text-3xl"
        >
          Desarrollo web y automatización en tu ciudad
        </h2>
        <p className="mt-3 max-w-2xl text-base font-light leading-relaxed text-muted-foreground dark:text-white/60">
          Trabajamos con empresas de todo México, con presencia local en Puerto Vallarta, Bahía de Banderas,
          Guadalajara y Zapopan. Elige tu ciudad:
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {groups.map((group) => (
            <div key={group.id} className="rounded-2xl border border-border bg-card/40 p-5 dark:border-white/10">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground dark:text-white">
                {group.title}
              </h3>
              <ul className="mt-4 flex flex-wrap gap-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={CHIP}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-card/40 p-5 dark:border-white/10">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground dark:text-white">
            Guías para decidir
          </h3>
          <ul className="mt-4 flex flex-wrap gap-2">
            {guides.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={CHIP}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
