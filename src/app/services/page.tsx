'use client';
import { motion } from 'framer-motion';
import Header from '@/components/header';
import { ServiceScene } from '@/components/services-animations/registry';
import { Footer } from '@/components/ui/footer-section';
import { ShinyButton } from '@/components/ui/shiny-button';
import { TechStackMarquee } from '@/components/ui/tech-stack-marquee';
import Link from 'next/link';

// Animation for main sections
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

// Animation for staggered grid items
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

// WO-2026-00341: cada tarjeta muestra la escena animada de su servicio (el
// mismo mapeo slug → escena del home, services-animations/registry.tsx) en
// lugar del icono lucide.
const services = [
    {
        slug: 'ecosistemas-web',
        title: 'Ecosistemas Web Avanzados',
        description: 'Creación de aplicaciones web robustas, CRMs personalizados y sitios corporativos ultra rápidos utilizando Next.js, React y Firebase.',
    },
    {
        slug: 'automatizacion',
        title: 'Automatización de Procesos',
        description: 'Desarrollo de scripts en Python, herramientas de validación de datos y bots de Telegram interactivos para optimizar la operación diaria y reducir tareas manuales.',
    },
    {
        slug: 'consultoria',
        title: 'Consultoría Tecnológica',
        description: 'Auditoría y digitalización de negocios. Desde la transición de procesos administrativos (como la gestión de flotillas o clínicas) hasta el rediseño UI/UX de tus sistemas actuales.',
    },
];

export default function ServicesPage() {
  return (
    <div className="bg-background text-foreground">
      <Header />
      <main className="flex-1">
        {/* 1. Hero Section */}
        <motion.section 
          className="relative flex items-center justify-center text-center overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-24"
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
        >
          <div className="absolute inset-0 z-0 dark:bg-black/50 dark:shadow-[0_0_80px_rgba(0,240,255,0.1)]" />
          <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl md:text-7xl">
              Soluciones de <span className="text-brand">Alto Impacto</span>
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg text-muted-foreground md:text-xl leading-relaxed">
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
                   <Link
                     href={`/services/${service.slug}`}
                     className="group block h-full rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
                   >
                        <ServiceCard
                            slug={service.slug}
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
                <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-8">
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
            <div className="rounded-2xl bg-gradient-to-tr from-primary/5 via-card to-card border border-border py-12 md:py-16 px-6 text-center shadow-[0_12px_40px_-16px_rgba(33,150,243,0.18)] dark:from-cyan-950/50 dark:via-[#0A0A0A] dark:to-[#0A0A0A] dark:shadow-[0_0_40px_rgba(0,240,255,0.05)]">
                <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                ¿Tienes un desafío operativo?
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground leading-relaxed">
                Permítenos analizar tu caso y proponerte una solución tecnológica a la medida.
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

// Tarjeta "escena arriba, lectura abajo" (patrón de listado tipo Airbnb): la
// escena corre sola al entrar al viewport y se pausa fuera de él; bajo
// prefers-reduced-motion se queda en su fotograma final. Va aria-hidden porque
// el enlace ya se nombra por el título: el `role="img"` de la escena no debe
// alargar el nombre accesible del link.
const ServiceCard = ({ slug, title, description }: { slug: string; title: string; description: string }) => {
  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-[transform,border-color,box-shadow] duration-300 group-hover:-translate-y-2 group-hover:border-primary/40 group-hover:shadow-[0_24px_48px_-24px_rgba(33,150,243,0.35)] dark:group-hover:border-cyan-500/50 dark:group-hover:shadow-[0_24px_48px_-24px_rgba(34,211,238,0.35)]">
      <div aria-hidden="true" className="relative h-[252px] shrink-0 overflow-hidden bg-[#06080d]">
        <ServiceScene slug={slug} layout="stage" />
      </div>
      <div className="flex flex-1 flex-col p-7">
        <h3 className="text-xl font-bold tracking-tight text-foreground">{title}</h3>
        <p className="mt-2 leading-relaxed text-muted-foreground">{description}</p>
        <span className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold text-brand">
          Conocer más
          <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </span>
      </div>
    </article>
  );
};
