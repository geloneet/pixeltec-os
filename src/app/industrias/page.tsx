import type { Metadata } from "next";
import Link from "next/link";
import { Truck, Stethoscope, Store, Package, CheckCircle } from "lucide-react";
import Header from "@/components/header";
import { Footer } from "@/components/ui/footer-section";
import { ShinyButton } from "@/components/ui/shiny-button";

export const metadata: Metadata = {
  title: "Industrias · Especialistas por sector",
  description:
    "PIXELTEC construye software a medida para logística, clínicas, retail y SaaS. Conoce los problemas específicos que resolvemos en cada vertical.",
  alternates: { canonical: "/industrias" },
};

const industries = [
  {
    icon: Truck,
    slug: "logistica",
    title: "Logística y Transportes",
    description:
      "Automatizamos rutas, despachos y facturación para empresas de transporte. Integraciones con sistemas SAT mexicanos, tracking en tiempo real, y dashboards operativos.",
    stack: ["Next.js", "Firebase", "Integraciones SAT", "Google Maps"],
    problems: [
      "Gestión de flotillas y mantenimiento",
      "Facturación electrónica automatizada",
      "Dashboards de KPIs operativos",
      "Apps móviles para conductores",
    ],
  },
  {
    icon: Stethoscope,
    slug: "salud",
    title: "Salud Dental y Clínicas",
    description:
      "Plataformas para clínicas dentales y consultorios: gestión de pacientes, agenda online, historiales clínicos digitales, y portal del paciente.",
    stack: ["Next.js", "Firebase", "Google Calendar", "WhatsApp API"],
    problems: [
      "Citas y agenda online",
      "Historial clínico digital",
      "Comunicación con pacientes vía WhatsApp/email",
      "Reportes y métricas del consultorio",
    ],
  },
  {
    icon: Store,
    slug: "retail",
    title: "Retail y Boutiques",
    description:
      "Llevamos negocios tradicionales al canal digital: e-commerce, inventario conectado, CRM de clientes, y automatización de ventas.",
    stack: ["Next.js", "Firebase", "Stripe / Mercado Pago", "Shopify alternatives"],
    problems: [
      "Migrar boutique física a venta online",
      "Inventario unificado físico + digital",
      "Automatización de marketing (email, WhatsApp)",
      "Reportes de ventas y rentabilidad",
    ],
  },
  {
    icon: Package,
    slug: "saas",
    title: "SaaS y Producto",
    description:
      "Construimos productos SaaS desde cero: MVP rápido, arquitectura escalable, y producción lista para crecer.",
    stack: ["Next.js", "Firebase", "Stripe", "Plataformas cloud"],
    problems: [
      "MVP en 8-12 semanas",
      "Arquitectura multi-tenant",
      "Sistema de billing + suscripciones",
      "Dashboard de analíticas de producto",
    ],
  },
];

export default function IndustriasPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#030303] text-white pt-32 sm:pt-40 pb-16 sm:pb-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          {/* Hero */}
          <header className="mb-16 md:mb-20 text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 tracking-tight">
              Especialistas por{" "}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 text-transparent bg-clip-text">
                industria
              </span>
            </h1>
            <p className="text-lg md:text-xl text-zinc-400 leading-relaxed">
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
                  className="group bg-[#0A0A0A] border border-white/5 rounded-2xl p-8 hover:border-cyan-500/30 hover:-translate-y-1 transition-all duration-300 flex flex-col gap-6"
                >
                  {/* Header */}
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/20 flex-shrink-0">
                      <Icon className="h-7 w-7 text-cyan-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white mb-2">{industry.title}</h2>
                      <p className="text-zinc-400 text-sm leading-relaxed">{industry.description}</p>
                    </div>
                  </div>

                  {/* Problems solved */}
                  <div>
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                      Problemas que resolvemos
                    </p>
                    <ul className="space-y-2">
                      {industry.problems.map((problem) => (
                        <li key={problem} className="flex items-start gap-2 text-sm text-zinc-300">
                          <CheckCircle className="h-4 w-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                          {problem}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Stack */}
                  <div>
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                      Stack típico
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {industry.stack.map((tech) => (
                        <span
                          key={tech}
                          className="text-xs px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="mt-auto pt-2">
                    <Link
                      href={`/contact?industry=${industry.slug}`}
                      className="inline-flex items-center text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors group-hover:underline underline-offset-4"
                    >
                      Conversar sobre este vertical →
                    </Link>
                  </div>
                </div>
              );
            })}
          </section>

          {/* Footer CTA */}
          <section className="rounded-2xl bg-gradient-to-tr from-cyan-950/50 via-[#0A0A0A] to-[#0A0A0A] border border-white/10 py-14 px-8 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              ¿Tu industria no está aquí?
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto mb-8 leading-relaxed">
              Trabajamos con empresas que buscan transformación digital seria en cualquier sector.
              Si tienes un problema operativo real, tenemos las herramientas para resolverlo.
            </p>
            <Link href="/contact">
              <ShinyButton>Agenda un diagnóstico gratuito</ShinyButton>
            </Link>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
