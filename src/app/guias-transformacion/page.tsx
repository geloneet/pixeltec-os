"use client";

import { motion } from "framer-motion";
import { Clock, Lock, Server, Cloud } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/header";
import { Footer } from "@/components/ui/footer-section";

// Base de datos de las guías corregida y completa
const guidesData = [
  {
    id: 1,
    title: "Playbook de IA 2026",
    description: "Cómo integrar agentes inteligentes en atención al cliente, automatizar respuestas y escalar tus ventas sin contratar más personal.",
    icon: Lock,
  },
  {
    id: 2,
    title: "Escalabilidad Cloud",
    description: "Arquitectura Next.js y Firebase. El manual técnico para soportar 100k usuarios concurrentes sin que tus servidores colapsen.",
    icon: Cloud,
  },
  {
    id: 3,
    title: "Auditoría Legacy",
    description: "El manual definitivo para modernizar procesos obsoletos, digitalizar tu operación y dejar atrás el papel y los excels interminables.",
    icon: Server,
  }
];

export default function GuiasTransformacionPage() {
  return (
    <>
      <Header />
      <div className="min-h-screen bg-[#030303] text-white pt-32 sm:pt-40 pb-16 sm:pb-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          
          {/* Encabezado Principal */}
          <div className="text-center mb-16 md:mb-20 flex flex-col items-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white to-cyan-400 pb-2">
              La Bóveda de Innovación
            </h1>
            <p className="text-lg md:text-xl text-zinc-400 max-w-3xl leading-relaxed">
              Playbooks, arquitecturas y estrategias confidenciales para escalar tu ecosistema digital.
            </p>
          </div>

          {/* Grid de Portadas 3D */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {guidesData.map((guide, index) => (
              <motion.div
                key={guide.id}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                className="group relative bg-[#0A0A0A] border border-white/5 rounded-2xl md:rounded-3xl p-8 flex flex-col justify-between aspect-[3/4] overflow-hidden hover:border-cyan-500/50 hover:shadow-[0_0_40px_rgba(0,240,255,0.15)] hover:-translate-y-2 md:hover:-translate-y-3 transition-all duration-500"
              >
                {/* Brillo de fondo sutil al hacer hover */}
                <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

                {/* Contenido Superior */}
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center mb-6 border border-cyan-500/20">
                    <guide.icon className="w-6 h-6 text-cyan-400" />
                  </div>
                  
                  <p className="text-cyan-400 text-xs font-bold tracking-[0.2em] uppercase mb-4">
                    Reporte Exclusivo
                  </p>
                  
                  <h3 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-4">
                    {guide.title}
                  </h3>
                  
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    {guide.description}
                  </p>
                </div>

                {/* Botón Inferior */}
                <div className="relative z-10 mt-8">
                  <button
                    onClick={() => toast.info("Disponible pronto — te avisamos cuando esté lista.")}
                    className="w-full flex items-center justify-center gap-2 bg-[#030303] border border-white/10 text-zinc-500 py-3 md:py-4 rounded-xl cursor-not-allowed transition-all duration-300 font-bold"
                  >
                    <Clock className="w-5 h-5" />
                    Próximamente
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

        </div>
      </div>
      <Footer />
    </>
  );
}
