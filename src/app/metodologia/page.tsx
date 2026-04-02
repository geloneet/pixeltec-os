'use client';

import { motion } from 'framer-motion';
import { Search, Code, Rocket, RefreshCw } from 'lucide-react';
import Link from 'next/link';

import Header from '@/components/header';
import { Footer } from '@/components/ui/footer-section';
import { ShinyButton } from '@/components/ui/shiny-button';

const processSteps = [
  {
    phase: '01',
    title: 'Diagnóstico y Arquitectura',
    description:
      'Auditamos tus procesos actuales. Definimos la arquitectura técnica (bases de datos, APIs) y trazamos la ruta más eficiente para tu negocio.',
    icon: <Search className="h-6 w-6 text-cyan-400" />,
  },
  {
    phase: '02',
    title: 'Desarrollo Ágil y Automatización',
    description:
      'Escribimos código limpio y escalable. Desde interfaces ultra rápidas con Next.js hasta scripts de Python para automatizar tareas repetitivas.',
    icon: <Code className="h-6 w-6 text-cyan-400" />,
  },
  {
    phase: '03',
    title: 'Despliegue e Integración',
    description:
      'Implementamos las soluciones en la nube (Cloud/Firebase) asegurando cero caídas. Conectamos tus nuevas herramientas con los sistemas que ya usas.',
    icon: <Rocket className="h-6 w-6 text-cyan-400" />,
  },
  {
    phase: '04',
    title: 'Evolución Continua',
    description:
      'La tecnología no se detiene. Monitoreamos el rendimiento, optimizamos procesos e integramos nuevas capas de Inteligencia Artificial según crezcas.',
    icon: <RefreshCw className="h-6 w-6 text-cyan-400" />,
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

export default function MetodologiaPage() {
  return (
    <div className="bg-[#030303] text-white">
      <Header />
      <main className="overflow-hidden">
        <motion.section
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="container mx-auto px-4 sm:px-6 lg:px-8 text-center pt-32 pb-12 sm:pt-40 sm:pb-16"
        >
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-400">
            Nuestra Metodología
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg text-white/60 md:text-xl leading-relaxed">
            Un proceso de ingeniería estructurado para transformar operaciones manuales en ecosistemas digitales escalables.
          </p>
        </motion.section>

        <section className="container mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-24 md:pb-32">
          <div className="relative max-w-3xl mx-auto">
            <div className="absolute top-0 bottom-0 left-6 w-px -translate-x-1/2 bg-white/10" />

            {processSteps.map((step) => (
              <motion.div
                key={step.phase}
                className="relative pl-12 md:pl-16 mb-12 md:mb-16 last:mb-0"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={cardVariants}
              >
                <div className="absolute top-0 left-6 -translate-x-1/2 z-10">
                  <div className="w-12 h-12 rounded-full bg-[#0A0A0A] border-2 border-cyan-500/50 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-cyan-950/50 flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.2)]">
                      {step.icon}
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/5 p-6 md:p-8 rounded-xl md:rounded-2xl hover:border-cyan-500/30 transition-colors duration-300 backdrop-blur-md">
                  <p className="text-sm font-bold tracking-[0.2em] text-cyan-400 mb-2">
                    FASE {step.phase}
                  </p>
                  <h3 className="text-xl md:text-2xl font-bold text-white mb-3">{step.title}</h3>
                  <p className="text-zinc-400 leading-relaxed">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="mt-16 md:mt-24 text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.5 }}
            variants={cardVariants}
          >
            <Link href="/contact">
              <ShinyButton className="w-full sm:w-auto">Agendar Diagnóstico</ShinyButton>
            </Link>
          </motion.div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
