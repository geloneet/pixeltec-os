import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { SmilemoreQaForm } from "@/components/smilemoreqa/SmilemoreQaForm";

// Cuestionario privado para el personal de Smile More — enlace directo que se
// comparte con la clínica, sin nav del sitio y fuera de buscadores/sitemap.
export const metadata: Metadata = buildMetadata({
  path: "/smilemoreqa",
  title: "Cuestionario Smile More · Corrección y Adaptación de Sistema",
  description:
    "Cuestionario de levantamiento y mejora del sistema de citas de Smile More.",
  noindex: true,
});

export default function SmilemoreQaPage() {
  return (
    <main className="min-h-screen bg-[#030303] text-white py-10 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
        <SmilemoreQaForm />
      </div>
    </main>
  );
}
