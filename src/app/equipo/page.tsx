import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import Image from "next/image";
import Link from "next/link";
import { Github, Linkedin, Users, Wrench } from "lucide-react";
import Header from "@/components/header";
import { Footer } from "@/components/ui/footer-section";
import { PlaceHolderImages } from "@/lib/placeholder-images";

export const metadata: Metadata = buildMetadata({
  path: '/equipo',
  title: 'Equipo · El equipo detrás de PIXELTEC',
  description: 'Conoce al equipo de tecnólogos con experiencia resolviendo problemas reales de negocio detrás de PIXELTEC.',
});

const miguelPhoto =
  PlaceHolderImages.find((img) => img.id === "miguel-robles-portrait")?.imageUrl ??
  "https://placehold.co/600x600/0a0a0a/ffffff?text=MR";

export default function EquipoPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#030303] text-white pt-32 sm:pt-40 pb-16 sm:pb-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          {/* Hero */}
          <header className="mb-16 md:mb-20 text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 tracking-tight">
              El equipo detrás de{" "}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 text-transparent bg-clip-text">
                PIXELTEC
              </span>
            </h1>
            <p className="text-lg md:text-xl text-zinc-400 leading-relaxed">
              Tecnólogos con experiencia resolviendo problemas reales de negocio.
            </p>
          </header>

          {/* Founder */}
          <section className="mb-20">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-8 text-center">
              Fundador
            </h2>
            <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-8 md:p-10 flex flex-col md:flex-row items-center md:items-start gap-8 max-w-2xl mx-auto">
              <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-2xl overflow-hidden border border-white/10 flex-shrink-0">
                <Image
                  src={miguelPhoto}
                  alt="Miguel Robles Sánchez — Founder PIXELTEC"
                  fill
                  className="object-cover object-top"
                  data-ai-hint="man portrait professional"
                />
              </div>
              <div className="text-center md:text-left">
                <h3 className="text-2xl font-bold text-white mb-1">Miguel Robles Sánchez</h3>
                <p className="text-cyan-400 font-semibold text-sm mb-4">
                  Founder &amp; Lead Software Architect
                </p>
                <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                  Ingeniero de software con experiencia construyendo ecosistemas digitales para
                  empresas mexicanas de logística, salud y retail. Diseña arquitecturas que van
                  desde el MVP hasta producción con miles de usuarios, con foco en rentabilidad
                  operativa y control total del negocio.
                </p>
                <div className="flex items-center justify-center md:justify-start gap-4">
                  <Link
                    href="#"
                    className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
                    aria-label="LinkedIn de Miguel Robles"
                  >
                    <Linkedin className="h-4 w-4" />
                    LinkedIn
                  </Link>
                  <Link
                    href="#"
                    className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
                    aria-label="GitHub de Miguel Robles"
                  >
                    <Github className="h-4 w-4" />
                    GitHub
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* Collaborators */}
          <section className="mb-20">
            <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-8 md:p-10 text-center md:text-left max-w-2xl mx-auto">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <Users className="h-5 w-5 text-zinc-400" />
                </div>
                <h2 className="text-lg font-bold text-white">Red de colaboradores</h2>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                PIXELTEC opera con una red extendida de especialistas en diseño, QA,
                infraestructura y branding que se integran por proyecto según las necesidades
                técnicas. Esto nos permite escalar capacidad sin sacrificar calidad ni
                comprometer los plazos.
              </p>
            </div>
          </section>

          {/* Hiring CTA */}
          <section>
            <div className="bg-gradient-to-tr from-cyan-950/50 via-[#0A0A0A] to-[#0A0A0A] border border-white/10 rounded-2xl p-8 md:p-10 text-center max-w-2xl mx-auto">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <Wrench className="h-5 w-5 text-cyan-400" />
                </div>
                <h2 className="text-lg font-bold text-white">¿Quieres unirte?</h2>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                Buscamos constantemente ingenieros, diseñadores y consultores con espíritu de
                dueño. Si te interesa construir software real para empresas reales,{" "}
                <Link
                  href="/contact"
                  className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4 transition-colors"
                >
                  escríbenos
                </Link>
                .
              </p>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
