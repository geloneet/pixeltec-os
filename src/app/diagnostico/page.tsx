import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import Header from "@/components/header";
import { Footer } from "@/components/ui/footer-section";
import { DiagnosticWizard } from "@/components/diagnostico/DiagnosticWizard";

export const metadata: Metadata = buildMetadata({
  path: '/diagnostico',
  title: 'Diagnóstico Inteligente · Evalúa la madurez digital de tu empresa',
  description: 'Responde unas preguntas y recibe en minutos una recomendación personalizada: nivel de madurez digital, oportunidades y servicios sugeridos para tu empresa.',
});

export default async function DiagnosticoPage({
  searchParams,
}: {
  searchParams: Promise<{ industry?: string }>;
}) {
  const params = await searchParams;

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#030303] text-white pt-32 sm:pt-40 pb-16 sm:pb-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <header className="mb-10 md:mb-12 text-center">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-4 tracking-tight">
              Diagnóstico{" "}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 text-transparent bg-clip-text">
                Inteligente
              </span>
            </h1>
            <p className="text-zinc-400 text-base md:text-lg leading-relaxed max-w-xl mx-auto">
              Responde unas preguntas y recibe una recomendación personalizada para tu empresa.
            </p>
          </header>

          <DiagnosticWizard variant="page" initialIndustry={params.industry} />
        </div>
      </main>
      <Footer />
    </>
  );
}
