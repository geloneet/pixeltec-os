import Link from 'next/link';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { ShinyButton } from '@/components/ui/shiny-button';
import type { IndustryWithPage } from '@/lib/content/industrias';
import { getLocalServiceCity, getServiceForCitySlug } from '@/lib/content/local-services';
import { getLocalCity } from '@/lib/content/automatizacion-local';
import { getKeywordLanding } from '@/lib/content/keyword-landings';

/**
 * Página de industria (WO-2026-00345, L2). Server Component: sin animación de
 * scroll ni `opacity:0` inicial — todo el texto viaja en el HTML (REN-01) y no
 * depende de hidratar. R-DM-001: extensión declarada del patrón de las landings
 * (`keyword-landing-page.tsx`: hero en tarjeta, H2 por sección, H3 en listas,
 * FAQ, CTA) y de los chips de `local-landings.tsx`; ninguna clase nueva.
 *
 * Header y Footer los monta `app/industrias/[slug]/page.tsx` para que este
 * componente se pueda renderizar en jsdom sin arrastrar `next/navigation`.
 *
 * Outline (playbook `estructura-contenido-seo`): un solo H1; H2 por sección de
 * contenido, caso real, relacionados, FAQ y CTA; H3 solo dentro de un H2.
 */
const CHIP =
  'inline-flex min-h-11 items-center rounded-full border border-primary/25 dark:border-cyan-500/25 bg-primary/5 dark:bg-cyan-500/5 px-4 py-2 text-sm font-medium text-brand hover:bg-primary/10 dark:hover:bg-cyan-500/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

/** Etiqueta legible de una landing existente, derivada de su registro. */
export function landingLabel(slug: string): string {
  const web = getLocalServiceCity(slug);
  if (web) {
    const service = getServiceForCitySlug(slug);
    const prefix = service?.serviceHref === '/services/consultoria' ? 'Consultoría TI' : 'Desarrollo web';
    return `${prefix} en ${web.city}`;
  }
  const automation = getLocalCity(slug);
  if (automation) return `Automatización en ${automation.city}`;
  const keyword = getKeywordLanding(slug);
  if (keyword) return keyword.keyword.charAt(0).toUpperCase() + keyword.keyword.slice(1);
  return slug;
}

export function IndustryPage({ industry }: { industry: IndustryWithPage }) {
  const { page } = industry;

  return (
    <div className="min-h-screen bg-background text-foreground pt-32 sm:pt-40 pb-16 sm:pb-24">
      <main className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 md:mb-10">
          <Link
            href="/industrias"
            className="group inline-flex items-center font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-5 w-5 transition-transform group-hover:-translate-x-1" aria-hidden="true" />
            Volver a Industrias
          </Link>
        </div>

        {/* Hero: único H1 de la página */}
        <section className="mb-12 rounded-2xl border border-border bg-card p-8 md:p-12 shadow-[0_12px_40px_-16px_rgba(33,150,243,0.18)] dark:shadow-[0_0_40px_rgba(0,240,255,0.05)]">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand">{industry.title}</p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">{page.h1}</h1>
          <p className="mt-4 max-w-3xl text-base md:text-lg text-muted-foreground leading-relaxed">{page.intro}</p>
        </section>

        {/* Secciones de contenido — H2 con H3 solo dentro de sus listas */}
        {page.sections.map((section) => (
          <section key={section.title} className="py-10 sm:py-14">
            <h2 className="mb-6 text-2xl sm:text-3xl font-bold text-foreground">{section.title}</h2>
            <div className="max-w-3xl space-y-4">
              {section.body.map((paragraph, index) => (
                <p key={index} className="text-muted-foreground leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
            {section.bullets && section.bullets.length > 0 && (
              <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                {section.bullets.map((bullet) => (
                  <li key={bullet.title} className="flex gap-4 rounded-xl border border-border/60 bg-card p-5 sm:p-6">
                    <CheckCircle className="mt-1 h-5 w-5 flex-shrink-0 text-brand" aria-hidden="true" />
                    <div>
                      <h3 className="font-bold text-foreground text-base sm:text-lg">{bullet.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{bullet.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        {/* Caso real — cliente ya público en los testimonios del home */}
        <section aria-labelledby="caso-real-heading" className="py-10 sm:py-14">
          <h2 id="caso-real-heading" className="mb-2 text-2xl sm:text-3xl font-bold text-foreground">
            {page.caseStudy.title}
          </h2>
          <p className="mb-6 text-sm font-semibold uppercase tracking-wide text-brand">
            {page.caseStudy.client} · {page.caseStudy.location}
          </p>
          <div className="max-w-3xl space-y-4">
            {page.caseStudy.summary.map((paragraph, index) => (
              <p key={index} className="text-muted-foreground leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
          {page.caseStudy.testimonial && (
            <figure className="mt-8 max-w-3xl rounded-2xl border border-primary/20 dark:border-cyan-500/20 bg-primary/5 dark:bg-cyan-950/20 p-6 md:p-8">
              <blockquote className="text-base md:text-lg font-light leading-relaxed text-foreground">
                “{page.caseStudy.testimonial.quote}”
              </blockquote>
              <figcaption className="mt-4 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{page.caseStudy.testimonial.author}</span>
                {' · '}
                {page.caseStudy.testimonial.role}
              </figcaption>
            </figure>
          )}
        </section>

        {/* Relacionado — servicios y landings de ciudad (chips de local-landings) */}
        <section aria-labelledby="relacionado-heading" className="rounded-2xl border border-border bg-card/40 p-6 sm:p-8 dark:border-white/10">
          <h2 id="relacionado-heading" className="text-lg sm:text-xl font-semibold text-foreground">
            Servicios y ciudades relacionadas
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {page.relatedServices.map((service) => (
              <li key={service.href}>
                <Link href={service.href} className={CHIP} data-cta="internal_link" data-cta-pos="industry_related">
                  {service.label}
                </Link>
              </li>
            ))}
            {page.relatedLandings.map((slug) => (
              <li key={slug}>
                <Link href={`/${slug}`} className={CHIP} data-cta="internal_link" data-cta-pos="industry_related">
                  {landingLabel(slug)}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ — texto idéntico al FAQPage schema que emite el page.tsx */}
        <section aria-labelledby="faq-heading" className="py-10 sm:py-14">
          <h2 id="faq-heading" className="mb-10 md:mb-12 text-center text-2xl sm:text-3xl font-bold text-foreground">
            Preguntas frecuentes
          </h2>
          <div className="mx-auto max-w-3xl space-y-6">
            {page.faq.map((item) => (
              <div key={item.q} className="rounded-xl border border-border bg-card p-6">
                <h3 className="font-bold text-foreground text-lg">{item.q}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-4 mb-8 md:mb-16 rounded-2xl bg-gradient-to-tr from-primary/5 via-card to-card border border-border py-12 md:py-16 px-6 text-center shadow-[0_12px_40px_-16px_rgba(33,150,243,0.18)] dark:from-cyan-950/50 dark:via-[#0A0A0A] dark:to-[#0A0A0A] dark:shadow-[0_0_40px_rgba(0,240,255,0.05)]">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">{page.ctaHeading}</h2>
          <p className="mx-auto mt-4 max-w-xl text-base sm:text-lg text-muted-foreground leading-relaxed">
            Empieza con un diagnóstico gratuito: revisamos cómo operas hoy y te decimos qué construir primero.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ShinyButton href={page.ctaHref} data-cta="diagnostico" data-cta-pos="industry_cta" className="w-full sm:w-auto">
              Empezar el diagnóstico gratuito
            </ShinyButton>
            <Link
              href="/contact"
              data-cta="contacto"
              data-cta-pos="industry_cta"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border dark:border-white/20 px-5 py-2.5 font-semibold text-foreground transition-colors hover:bg-secondary dark:hover:bg-white/10"
            >
              Hablar con el equipo
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
