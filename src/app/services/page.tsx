'use client';
import { motion } from 'framer-motion';
import { Globe, Bot, Briefcase } from 'lucide-react';
import Header from '@/components/header';
import { Footer } from '@/components/ui/footer-section';
import { ShinyButton } from '@/components/ui/shiny-button';
import { TechStackMarquee } from '@/components/ui/tech-stack-marquee';
import Link from 'next/link';

// Animation for main sections
const sectionVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.8, ease: 'easeOut' }
  },
};

// Animation for staggered grid items
const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: {
            delay: i * 0.15,
            duration: 0.5,
            ease: 'easeOut',
        },
    }),
};

const services = [
    {
        slug: 'ecosistemas-web',
        icon: <Globe className="h-8 w-8 text-brand-blue" />,
        title: 'Ecosistemas Web Avanzados',
        description: 'Creación de aplicaciones web robustas, CRMs personalizados y sitios corporativos ultra rápidos utilizando Next.js, React y Firebase.',
    },
    {
        slug: 'automatizacion',
        icon: <Bot className="h-8 w-8 text-brand-blue" />,
        title: 'Automatización de Procesos',
        description: 'Desarrollo de scripts en Python, herramientas de validación de datos y bots de Telegram interactivos para optimizar la operación diaria y reducir tareas manuales.',
    },
    {
        slug: 'consultoria',
        icon: <Briefcase className="h-8 w-8 text-brand-blue" />,
        title: 'Consultoría Tecnológica',
        description: 'Auditoría y digitalización de negocios. Desde la transición de procesos administrativos (como la gestión de flotillas o clínicas) hasta el rediseño UI/UX de tus sistemas actuales.',
    },
];

export default function ServicesPage() {
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
          <div className="absolute inset-0 z-0 bg-black/50 shadow-[0_0_80px_rgba(0,240,255,0.1)]" />
          <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl md:text-7xl">
              Soluciones de <span className="text-brand-blue">Alto Impacto</span>
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg text-white/60 md:text-xl leading-relaxed">
              Desarrollamos tecnología a la medida para modernizar la logística, operación y presencia digital de tu empresa.
            </p>
          </div>
        </motion.section>

        {/* 2. Services Grid */}
        <motion.section 
          className="py-16 sm:py-24 md:py-32"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={sectionVariants}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {services.map((service, i) => (
                <motion.div key={service.title} custom={i} variants={cardVariants}>
                   <Link href={`/services/${service.slug}`} className="block h-full group">
                        <ServiceCard
                            icon={service.icon}
                            title={service.title}
                            description={service.description}
                        />
                   </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* 3. Tech Stack Section */}
        <motion.section
            className="py-16 sm:py-24"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.5 }}
            variants={sectionVariants}
        >
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 mb-8">
                    Tecnologías que Dominamos
                </h3>
                <TechStackMarquee />
            </div>
        </motion.section>

        {/* 4. CTA Section */}
        <motion.section 
          className="py-16 sm:py-24"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
          variants={sectionVariants}
        >
          <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl bg-gradient-to-tr from-cyan-950/50 via-[#0A0A0A] to-[#0A0A0A] border border-white/10 py-12 md:py-16 px-6 text-center shadow-[0_0_40px_rgba(0,240,255,0.05)]">
                <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                ¿Tienes un desafío operativo?
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-lg text-white/60 leading-relaxed">
                Permítenos analizar tu caso y proponerte una solución tecnológica a la medida.
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

const ServiceCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => {
  return (
    <div className="relative h-full rounded-2xl border border-white/10 bg-[#0A0A0A] p-8 backdrop-blur-md transition-all duration-300 group-hover:border-cyan-500/50 group-hover:bg-cyan-950/20 group-hover:-translate-y-2 overflow-hidden">
      <div className="mb-4 text-brand-blue transition-colors duration-300 group-hover:text-cyan-300">{icon}</div>
      <h3 className="text-xl font-bold text-white">{title}</h3>
      <p className="mt-2 text-white/60 leading-relaxed">{description}</p>
    </div>
  );
};
