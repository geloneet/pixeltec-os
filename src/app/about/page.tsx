'use client';
import { motion } from 'framer-motion';
import { Code, Cpu, Briefcase } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import Header from '@/components/header';
import { Footer } from '@/components/ui/footer-section';
import { ShinyButton } from '@/components/ui/shiny-button';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';

// Animation variants for sections
const sectionVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.8, ease: 'easeOut' }
  },
};

const getImageUrl = (id: string) => {
    return PlaceHolderImages.find(img => img.id === id)?.imageUrl || 'https://placehold.co/600x600/png';
}

export default function AboutPage() {
  return (
    <div className="bg-[#030303] text-white">
      <Header />
      <main className="flex-1">
        {/* 1. Hero Section */}
        <motion.section 
          className="relative flex items-center justify-center text-center overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-24"
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
        >
          <div className="absolute inset-0 z-0 opacity-20">
            <div className="absolute -top-1/4 -left-1/4 h-1/2 w-1/2 rounded-full bg-cyan-500/50 blur-[150px]" />
            <div className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-blue-500/40 blur-[150px]" />
          </div>
          <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl md:text-7xl">
              Arquitectos de la <span className="text-brand-blue">Innovación Tecnológica.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg text-white/60 md:text-xl leading-relaxed">
              Combinamos consultoría empresarial con desarrollo de software de alto nivel para escalar tu ecosistema digital.
            </p>
          </div>
        </motion.section>

        {/* 2. Identity Section */}
        <motion.section 
          className="py-16 sm:py-24 md:py-32"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={sectionVariants}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-3 lg:gap-20">
              <div className="relative h-[400px] w-full rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md md:h-[500px] md:col-span-1">
                <Image
                  src={getImageUrl('miguel-robles-portrait')}
                  alt="Miguel Robles, líder de PixelTEC"
                  fill
                  className="rounded-lg object-cover object-right"
                  data-ai-hint="man portrait"
                />
              </div>
              <div className="text-center md:text-left md:col-span-2">
                <h2 className="text-3xl font-bold tracking-tight text-white/90 sm:text-4xl">
                  Un Aliado <span className="text-brand-blue">Estratégico</span>, no solo un Proveedor.
                </h2>
                <p className="mt-6 text-lg leading-relaxed text-white/60">
                  PixelTEC, liderada por <span className="font-semibold text-white">Miguel Robles</span>, nació para cerrar la brecha entre la estrategia de negocio y la ejecución tecnológica. Entendemos que el código es una herramienta poderosa, pero su verdadero valor se desbloquea cuando se alinea con objetivos comerciales claros.
                </p>
                <p className="mt-4 text-lg leading-relaxed text-white/60">
                  Somos un equipo híbrido de consultores y desarrolladores que no solo construye software, sino que diseña ecosistemas digitales que impulsan el crecimiento y la eficiencia.
                </p>
              </div>
            </div>
          </div>
        </motion.section>
        
        {/* 3. Methodology Section */}
        <motion.section 
          className="py-16 sm:py-24 md:py-32"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={sectionVariants}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Nuestros Pilares</h2>
                <p className="mt-4 text-lg leading-relaxed text-white/60">
                    Así es como convertimos tus desafíos en ventajas competitivas.
                </p>
            </div>
            <div className="mt-12 md:mt-16 grid grid-cols-1 gap-6 md:gap-8 md:grid-cols-3">
              <Link href="/services/ecosistemas-web" className="block h-full group">
                <PillarCard
                  icon={<Code className="h-8 w-8 text-brand-blue" />}
                  title="Desarrollo a la Medida"
                  description="Creamos aplicaciones web y móviles robustas y escalables con tecnologías de vanguardia como Next.js y React. Arquitecturas pensadas para el futuro."
                />
              </Link>
              <Link href="/services/automatizacion" className="block h-full group">
                <PillarCard
                  icon={<Cpu className="h-8 w-8 text-brand-blue" />}
                  title="Automatización e IA"
                  description="Desde scripts en Python que optimizan tareas repetitivas hasta la integración de bots inteligentes, automatizamos tus procesos para que te enfoques en crecer."
                />
              </Link>
              <Link href="/services/consultoria" className="block h-full group">
                <PillarCard
                  icon={<Briefcase className="h-8 w-8 text-brand-blue" />}
                  title="Consultoría Empresarial"
                  description="Analizamos tus operaciones y datos para identificar oportunidades de modernización. Te guiamos en cada paso de tu transformación digital."
                />
              </Link>
            </div>
          </div>
        </motion.section>

        {/* 4. CTA Section */}
        <motion.section 
          className="py-16 sm:py-24 md:py-32"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
          variants={sectionVariants}
        >
          <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl bg-gradient-to-tr from-cyan-950/50 via-[#0A0A0A] to-[#0A0A0A] border border-white/10 py-12 md:py-16 px-6 text-center shadow-[0_0_40px_rgba(0,240,255,0.05)]">
                <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                ¿Listo para construir el futuro?
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-white/60">
                Hablemos de cómo la tecnología puede transformar tu negocio.
                </p>
                <div className="mt-8">
                <Link href="/contact">
                    <ShinyButton className="w-full sm:w-auto">
                        Agendar Diagnóstico
                    </ShinyButton>
                </Link>
                </div>
            </div>
          </div>
        </motion.section>
      </main>
      <Footer />
    </div>
  );
}

const PillarCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => {
  return (
    <div className="relative h-full rounded-2xl border border-white/10 bg-[#0A0A0A] p-8 overflow-hidden transition-all duration-300 group-hover:border-brand-blue/50 group-hover:bg-blue-950/20 group-hover:-translate-y-1">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-white">{title}</h3>
      <p className="mt-2 text-white/60">{description}</p>
    </div>
  );
};
