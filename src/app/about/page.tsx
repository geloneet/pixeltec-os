'use client';
import { motion } from 'framer-motion';
import Image from 'next/image';

import Header from '@/components/header';
import { ServiceSceneCard } from '@/components/services-animations/service-scene-card';
import { Footer } from '@/components/ui/footer-section';
import { ShinyButton } from '@/components/ui/shiny-button';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';

// Animation variants for sections
// REN-01 (WO-2026-00268): el scroll-reveal anima SOLO transform. Con
// `opacity: 0` en el estado inicial, todo este contenido salía invisible del
// servidor y no aparecía nunca si framer-motion no hidrataba (JS lento o
// bloqueado); los rastreadores que no ejecutan JS veían la página en blanco.
const sectionVariants = {
  hidden: { y: 50 },
  visible: { 
    y: 0,
    transition: { duration: 0.8, ease: 'easeOut' }
  },
};

// Entrada escalonada de las tarjetas de Pilares (solo transform, REN-01):
// mismo stagger que las tarjetas de /services.
const cardVariants = {
  hidden: { y: 20 },
  visible: (i: number) => ({
    y: 0,
    transition: {
      delay: i * 0.15,
      duration: 0.5,
      ease: 'easeOut',
    },
  }),
};

// WO-2026-00342: cada pilar es un servicio y muestra su escena animada (mapeo
// slug → escena de services-animations/registry.tsx) con la misma tarjeta de
// /services, en lugar del icono lucide. Título y descripción se conservan.
const pillars = [
  {
    slug: 'ecosistemas-web',
    title: 'Desarrollo a la Medida',
    description: 'Creamos aplicaciones web y móviles robustas y escalables con tecnologías de vanguardia como Next.js y React. Arquitecturas pensadas para el futuro.',
  },
  {
    slug: 'automatizacion',
    title: 'Automatización e IA',
    description: 'Desde scripts en Python que optimizan tareas repetitivas hasta la integración de bots inteligentes, automatizamos tus procesos para que te enfoques en crecer.',
  },
  {
    slug: 'consultoria',
    title: 'Consultoría Empresarial',
    description: 'Analizamos tus operaciones y datos para identificar oportunidades de modernización. Te guiamos en cada paso de tu transformación digital.',
  },
] as const;

const getImageUrl = (id: string) => {
    return PlaceHolderImages.find(img => img.id === id)?.imageUrl || 'https://placehold.co/600x600/png';
}

export default function AboutPage() {
  return (
    <div className="bg-background dark:bg-[#030303] text-foreground dark:text-white">
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
            <div className="absolute -top-1/4 -left-1/4 h-1/2 w-1/2 rounded-full bg-primary/20 dark:bg-cyan-500/50 blur-[150px]" />
            <div className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-blue-500/15 dark:bg-blue-500/40 blur-[150px]" />
          </div>
          <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl md:text-7xl">
              Arquitectos de la <span className="text-brand">Innovación Tecnológica.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg text-muted-foreground dark:text-white/60 md:text-xl leading-relaxed">
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
              <div className="relative h-[400px] w-full rounded-2xl border border-border dark:border-white/10 bg-secondary/60 dark:bg-white/5 p-4 backdrop-blur-md md:h-[500px] md:col-span-1">
                <Image
                  src={getImageUrl('miguel-robles-portrait')}
                  alt="Miguel Robles, líder de PixelTEC"
                  fill
                  className="rounded-lg object-cover object-right"
                  data-ai-hint="man portrait"
                />
              </div>
              <div className="text-center md:text-left md:col-span-2">
                <h2 className="text-3xl font-bold tracking-tight text-foreground dark:text-white/90 sm:text-4xl">
                  Un Aliado <span className="text-brand">Estratégico</span>, no solo un Proveedor.
                </h2>
                <p className="mt-6 text-lg leading-relaxed text-muted-foreground dark:text-white/60">
                  PixelTEC, liderada por <span className="font-semibold text-foreground dark:text-white">Miguel Robles</span>, nació para cerrar la brecha entre la estrategia de negocio y la ejecución tecnológica. Entendemos que el código es una herramienta poderosa, pero su verdadero valor se desbloquea cuando se alinea con objetivos comerciales claros.
                </p>
                <p className="mt-4 text-lg leading-relaxed text-muted-foreground dark:text-white/60">
                  Cada proyecto lo dirige un arquitecto líder y se apoya en una red de especialistas —diseño, QA, infraestructura, branding— que se integra según lo que ese proyecto exige. No solo construimos software: diseñamos ecosistemas digitales que impulsan el crecimiento y la eficiencia.
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
                <h2 className="text-3xl font-bold tracking-tight text-foreground dark:text-white sm:text-4xl">Nuestros Pilares</h2>
                <p className="mt-4 text-lg leading-relaxed text-muted-foreground dark:text-white/60">
                    Así es como convertimos tus desafíos en ventajas competitivas.
                </p>
            </div>
            <div className="mt-12 md:mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {pillars.map((pillar, i) => (
                <motion.div key={pillar.slug} custom={i} variants={cardVariants}>
                  <ServiceSceneCard slug={pillar.slug} title={pillar.title} description={pillar.description} />
                </motion.div>
              ))}
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
            <div className="rounded-2xl bg-gradient-to-tr from-primary/5 via-card to-card border border-border py-12 md:py-16 px-6 text-center shadow-[0_12px_40px_-16px_rgba(33,150,243,0.18)] dark:from-cyan-950/50 dark:via-[#0A0A0A] dark:to-[#0A0A0A] dark:border-white/10 dark:shadow-[0_0_40px_rgba(0,240,255,0.05)]">
                <h2 className="text-3xl font-bold tracking-tight text-foreground dark:text-white sm:text-4xl">
                ¿Listo para construir el futuro?
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground dark:text-white/60">
                Hablemos de cómo la tecnología puede transformar tu negocio.
                </p>
                <div className="mt-8">
                <ShinyButton href="/contact" className="w-full sm:w-auto">
                    Hablar con un especialista
                </ShinyButton>
                </div>
            </div>
          </div>
        </motion.section>
      </main>
      <Footer />
    </div>
  );
}
