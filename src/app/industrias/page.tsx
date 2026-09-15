import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import Link from "next/link";
import { Truck, Droplets, Stethoscope, Hotel, ShoppingBag, Sun, CheckCircle, type LucideIcon } from "lucide-react";
import Header from "@/components/header";
import { Footer } from "@/components/ui/footer-section";
import { ShinyButton } from "@/components/ui/shiny-button";
import { SITE } from "@/lib/site-config";
import { BreadcrumbStructuredData } from "@/components/seo/structured-data";
import { IndustryHubStructuredData } from "@/components/seo/industry-structured-data";
import { INDUSTRIES, industryPagePath, type IndustryIcon } from "@/lib/content/industrias";

// L2 (WO-2026-00345): title con intención de búsqueda («software para
// <sector>») y description sin sectores que no existen en la página. El H1 ya
// no es «Especialistas por industria»: dice qué vendemos.
export const metadata: Metadata = buildMetadata({
  path: '/industrias',
  title: 'Software para clínicas, hoteles, logística y más',
  description:
    'Software a la medida para clínicas dentales, hoteles, logística, distribución de agua, comercio y energía solar, con casos reales de clientes en Jalisco.',
});

// Único mapa de UI: el icono. Todo lo demás (claims, stack, tipo de
// diagnóstico, páginas propias) sale del registro `@/lib/content/industrias`.
const ICONS: Record<IndustryIcon, LucideIcon> = { Truck, Droplets, Stethoscope, Hotel, ShoppingBag, Sun };

export default function IndustriasPage() {
  return (
    <>
      <BreadcrumbStructuredData items={[
        { name: SITE.name, url: SITE.url },
        { name: 'Industrias', url: `${SITE.url}/industrias` },
      ]} />
      <IndustryHubStructuredData />
      <Header />
      <main className="min-h-screen bg-background dark:bg-[#030303] text-foreground dark:text-white pt-32 sm:pt-40 pb-16 sm:pb-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          {/* Hero */}
          <header className="mb-16 md:mb-20 text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground dark:text-white mb-6 tracking-tight">
              Software a la medida para tu{" "}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 text-transparent bg-clip-text">
                industria
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground dark:text-zinc-400 leading-relaxed">
              Construimos software para sectores donde ya trabajamos con clientes reales: cada bloque describe
              lo que está en producción hoy. Trabajamos con empresas de todo México, con presencia local en
              Puerto Vallarta, Bahía de Banderas, Guadalajara y Zapopan.
            </p>
          </header>

          {/* Industry tiles */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-20">
            {INDUSTRIES.map((industry) => {
              const Icon = ICONS[industry.icon];
              const pageHref = industry.page ? industryPagePath(industry.page) : null;
              return (
                <div
                  key={industry.slug}
                  className="group bg-card dark:bg-[#0A0A0A] border border-border dark:border-white/5 rounded-2xl p-8 hover:border-primary/30 dark:hover:border-cyan-500/30 hover:-translate-y-1 transition-all duration-300 flex flex-col gap-6"
                >
                  {/* Header */}
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-primary/5 dark:bg-cyan-950/40 border border-primary/20 dark:border-cyan-500/20 flex-shrink-0">
                      <Icon className="h-7 w-7 text-brand" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-foreground dark:text-white mb-2">
                        {pageHref ? (
                          <Link href={pageHref} className="hover:text-brand transition-colors underline-offset-4 hover:underline">
                            {industry.title}
                          </Link>
                        ) : (
                          industry.title
                        )}
                      </h2>
                      <p className="text-muted-foreground dark:text-zinc-400 text-sm leading-relaxed">{industry.summary}</p>
                    </div>
                  </div>

                  {/* Lo que resolvemos — solo lo sostenido por la ficha del cliente */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground dark:text-zinc-500 uppercase tracking-wider mb-3">
                      Lo que resolvemos
                    </p>
                    <ul className="space-y-2">
                      {industry.problems.map((problem) => (
                        <li key={problem} className="flex items-start gap-2 text-sm text-foreground/85 dark:text-zinc-300">
                          <CheckCircle className="h-4 w-4 text-brand flex-shrink-0 mt-0.5" aria-hidden="true" />
                          {problem}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Stack */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground dark:text-zinc-500 uppercase tracking-wider mb-3">
                      Stack típico
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {industry.stack.map((tech) => (
                        <span
                          key={tech}
                          className="text-xs px-2.5 py-1 rounded-md bg-muted dark:bg-zinc-900 border border-border dark:border-zinc-800 text-muted-foreground dark:text-zinc-400"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="mt-auto pt-2">
                    {pageHref ? (
                      <Link
                        href={pageHref}
                        className="inline-flex items-center text-sm font-semibold text-brand hover:text-brand/80 dark:hover:text-cyan-300 transition-colors group-hover:underline underline-offset-4"
                      >
                        Ver caso y solución →
                      </Link>
                    ) : (
                      <Link
                        href={`/diagnostico?industry=${industry.diagnosticType}`}
                        className="inline-flex items-center text-sm font-semibold text-brand hover:text-brand/80 dark:hover:text-cyan-300 transition-colors group-hover:underline underline-offset-4"
                      >
                        Conversar sobre este sector →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </section>

          {/* Footer CTA */}
          <section className="rounded-2xl bg-gradient-to-tr from-primary/5 via-card to-card dark:from-cyan-950/50 dark:via-[#0A0A0A] dark:to-[#0A0A0A] border border-border dark:border-white/10 py-14 px-8 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground dark:text-white mb-4">
              ¿Tu industria no está aquí?
            </h2>
            <p className="text-muted-foreground dark:text-zinc-400 max-w-xl mx-auto mb-8 leading-relaxed">
              Trabajamos con empresas que buscan transformación digital seria en cualquier sector.
              Si tienes un problema operativo real, tenemos las herramientas para resolverlo.
            </p>
            <ShinyButton href="/contact">Hablar con un especialista</ShinyButton>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
