import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import Link from "next/link";
import { Truck, Droplets, Stethoscope, Hotel, ShoppingBag, Sun, CheckCircle } from "lucide-react";
import Header from "@/components/header";
import { Footer } from "@/components/ui/footer-section";
import { ShinyButton } from "@/components/ui/shiny-button";

export const metadata: Metadata = buildMetadata({
  path: '/industrias',
  title: 'Industrias · Especialistas por sector',
  description: 'PixelTEC construye software a medida para logística, clínicas, retail y SaaS. Conoce los problemas específicos que resolvemos en cada vertical.',
});

// Solo sectores con al menos un cliente real documentado. El stack refleja el
// vigente (Next.js + PostgreSQL, ADR-0001/ADR-0022); Firebase quedó como
// legacy de proyectos anteriores, no como tecnología actual.
const industries = [
  {
    icon: Truck,
    slug: "logistica",
    title: "Logística y Transportes",
    description:
      "Automatizamos rutas, despachos y facturación para empresas de transporte. Integraciones con sistemas SAT mexicanos, tracking en tiempo real, y dashboards operativos.",
    stack: ["Next.js", "PostgreSQL", "Integraciones SAT", "Google Maps"],
    problems: [
      "Gestión de flotillas y mantenimiento",
      "Facturación electrónica automatizada",
      "Dashboards de KPIs operativos",
      "Apps móviles para conductores",
    ],
  },
  {
    icon: Droplets,
    slug: "agua",
    title: "Distribución de Agua",
    description:
      "Digitalizamos la operación de distribuidoras: pedidos, rutas de reparto, control de clientes recurrentes y cobranza, con visibilidad diaria de la operación.",
    stack: ["Next.js", "PostgreSQL", "WhatsApp API", "Reportes operativos"],
    problems: [
      "Pedidos y rutas de reparto",
      "Control de clientes recurrentes",
      "Cobranza y seguimiento de saldos",
      "Reportes diarios de operación",
    ],
  },
  {
    icon: Stethoscope,
    slug: "salud",
    title: "Salud Dental y Clínicas",
    description:
      "Plataformas para clínicas dentales y consultorios: gestión de pacientes, agenda online, historiales clínicos digitales, y portal del paciente.",
    stack: ["Next.js", "PostgreSQL", "Google Calendar", "WhatsApp API"],
    problems: [
      "Citas y agenda online",
      "Historial clínico digital",
      "Comunicación con pacientes vía WhatsApp/email",
      "Reportes y métricas del consultorio",
    ],
  },
  {
    icon: Hotel,
    slug: "hoteleria",
    title: "Hotelería y Hospedaje",
    description:
      "Sistemas de reservas a medida para hoteles y villas: disponibilidad, gestión de huéspedes y comunicación directa, sin depender solo de plataformas de terceros.",
    stack: ["Next.js", "PostgreSQL", "Pasarelas de pago", "WhatsApp API"],
    problems: [
      "Reservas directas sin comisiones de terceros",
      "Calendario de disponibilidad y tarifas",
      "Gestión de huéspedes y seguimiento",
      "Reportes de ocupación",
    ],
  },
  {
    icon: ShoppingBag,
    slug: "moda",
    title: "Moda y Comercio Especializado",
    description:
      "Llevamos marcas y comercios especializados al canal digital: e-commerce, inventario conectado, CRM de clientes y automatización de ventas.",
    stack: ["Next.js", "PostgreSQL", "Stripe / Mercado Pago", "Cloudflare R2"],
    problems: [
      "Tienda en línea con identidad propia",
      "Inventario unificado físico + digital",
      "Automatización de marketing (email, WhatsApp)",
      "Reportes de ventas y rentabilidad",
    ],
  },
  {
    icon: Sun,
    slug: "solar",
    title: "Energía Solar",
    description:
      "Herramientas para instaladores y comercializadoras: cotizadores que calculan el dimensionamiento y el retorno, captura de prospectos y seguimiento comercial.",
    stack: ["Next.js", "PostgreSQL", "Cotizador a medida", "WhatsApp API"],
    problems: [
      "Cotizador de sistemas fotovoltaicos",
      "Cálculo de ahorro y retorno de inversión",
      "Captura y seguimiento de prospectos",
      "Propuestas comerciales automatizadas",
    ],
  },
];

// Mapea el slug de esta página al `value` de COMPANY_TYPES en
// src/lib/diagnostic/logic.ts, para preseleccionar el tipo de empresa en el
// wizard de /diagnostico.
//
// CON-05 (WO-2026-00268): antes «agua» caía en 'servicios' y «solar» en
// 'otra', así que quien llegaba desde esas dos secciones veía el wizard
// preseleccionado con una categoría que no era la suya. Ahora los seis
// sectores que el sitio declara servir tienen su equivalente exacto en el
// catálogo — ninguno cae ya en un cajón de sastre.
const DIAGNOSTIC_INDUSTRY_MAP: Record<string, string> = {
  logistica: 'logistica',
  agua: 'agua',
  salud: 'clinica',
  hoteleria: 'hotel',
  moda: 'retail',
  solar: 'solar',
};

export default function IndustriasPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-background dark:bg-[#030303] text-foreground dark:text-white pt-32 sm:pt-40 pb-16 sm:pb-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          {/* Hero */}
          <header className="mb-16 md:mb-20 text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground dark:text-white mb-6 tracking-tight">
              Especialistas por{" "}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 text-transparent bg-clip-text">
                industria
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground dark:text-zinc-400 leading-relaxed">
              Resolvemos problemas específicos con tecnología adaptada al sector.
              No vendemos templates — construimos soluciones que entienden tu operación.
            </p>
          </header>

          {/* Industry tiles */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-20">
            {industries.map((industry) => {
              const Icon = industry.icon;
              return (
                <div
                  key={industry.slug}
                  className="group bg-card dark:bg-[#0A0A0A] border border-border dark:border-white/5 rounded-2xl p-8 hover:border-primary/30 dark:hover:border-cyan-500/30 hover:-translate-y-1 transition-all duration-300 flex flex-col gap-6"
                >
                  {/* Header */}
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-primary/5 dark:bg-cyan-950/40 border border-primary/20 dark:border-cyan-500/20 flex-shrink-0">
                      <Icon className="h-7 w-7 text-brand" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-foreground dark:text-white mb-2">{industry.title}</h2>
                      <p className="text-muted-foreground dark:text-zinc-400 text-sm leading-relaxed">{industry.description}</p>
                    </div>
                  </div>

                  {/* Problems solved */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground dark:text-zinc-500 uppercase tracking-wider mb-3">
                      Problemas que resolvemos
                    </p>
                    <ul className="space-y-2">
                      {industry.problems.map((problem) => (
                        <li key={problem} className="flex items-start gap-2 text-sm text-foreground/85 dark:text-zinc-300">
                          <CheckCircle className="h-4 w-4 text-brand flex-shrink-0 mt-0.5" />
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
                    <Link
                      href={`/diagnostico?industry=${DIAGNOSTIC_INDUSTRY_MAP[industry.slug] ?? ''}`}
                      className="inline-flex items-center text-sm font-semibold text-brand hover:text-brand/80 dark:hover:text-cyan-300 transition-colors group-hover:underline underline-offset-4"
                    >
                      Conversar sobre este vertical →
                    </Link>
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
