'use client';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle,
  Globe,
  Bot,
  Briefcase,
  DatabaseZap,
  ShoppingCart,
  Laptop,
  Network,
  MessageSquareText,
  FileScan,
  BarChart3,
  MailCheck,
  SearchCode,
  Combine,
  Palette,
  Users,
} from 'lucide-react';
import Header from '@/components/header';
import { Footer } from '@/components/ui/footer-section';
import { ShinyButton } from '@/components/ui/shiny-button';
import { ServiceStructuredData } from '@/components/seo/structured-data';

const servicesData = [
    {
        slug: 'ecosistemas-web',
        icon: <Globe className="h-10 w-10 md:h-12 md:w-12 text-cyan-400" />,
        title: 'Ecosistemas Web Avanzados',
        description: 'Creación de aplicaciones web robustas, CRMs personalizados y sitios corporativos ultra rápidos. Construimos con tecnologías de vanguardia como Next.js, React y Firebase, diseñando arquitecturas escalables preparadas para el futuro de tu negocio.',
        features: [
            'Desarrollo Full-Stack con Next.js',
            'Bases de Datos en tiempo real con Firebase',
            'Interfaces de usuario reactivas con React',
            'Optimización de rendimiento (Core Web Vitals)',
            'Diseño de CRMs y dashboards a la medida',
            'Integración de APIs de terceros',
        ],
        useCases: [
            {
                icon: <DatabaseZap className="h-7 w-7 md:h-8 md:w-8" />,
                title: 'CRMs y Sistemas Internos',
                description: 'Desarrollamos dashboards y sistemas de gestión a medida que centralizan tu información y optimizan la toma de decisiones.'
            },
            {
                icon: <ShoppingCart className="h-7 w-7 md:h-8 md:w-8" />,
                title: 'Plataformas E-commerce',
                description: 'Construimos tiendas en línea de alto rendimiento con pasarelas de pago seguras y una experiencia de usuario fluida.'
            },
            {
                icon: <Laptop className="h-7 w-7 md:h-8 md:w-8" />,
                title: 'Aplicaciones Web Progresivas (PWA)',
                description: 'Creamos aplicaciones que se instalan en dispositivos, funcionan offline y ofrecen notificaciones push para mayor engagement.'
            },
            {
                icon: <Network className="h-7 w-7 md:h-8 md:w-8" />,
                title: 'Integración de APIs y Servicios',
                description: 'Conectamos tu ecosistema web con servicios de terceros (facturación, logística, marketing) para un flujo de datos unificado.'
            }
        ],
        process: [
            'Descubrimiento y Estrategia',
            'Diseño de Arquitectura y UX/UI',
            'Desarrollo por Sprints (Ágil)',
            'Pruebas y Despliegue',
            'Soporte y Evolución Continua'
        ]
    },
    {
        slug: 'automatizacion',
        icon: <Bot className="h-10 w-10 md:h-12 md:w-12 text-cyan-400" />,
        title: 'Automatización de Procesos con IA',
        description: 'Desarrollamos scripts en Python, herramientas de validación de datos y bots de Telegram o WhatsApp interactivos para optimizar la operación diaria, reducir tareas manuales y permitir que tu equipo se enfoque en el crecimiento.',
        features: [
            'Scripts de automatización con Python',
            'Integración de Modelos de Lenguaje (LLMs)',
            'Bots para WhatsApp y Telegram',
            'Procesamiento y validación de datos masivos',
            'Optimización de flujos de trabajo repetitivos',
            'Generación automática de reportes',
        ],
        useCases: [
            {
                icon: <MessageSquareText className="h-7 w-7 md:h-8 md:w-8" />,
                title: 'Bots de Atención al Cliente',
                description: 'Implementamos chatbots en WhatsApp o tu web que responden preguntas frecuentes y califican prospectos 24/7.'
            },
            {
                icon: <FileScan className="h-7 w-7 md:h-8 md:w-8" />,
                title: 'Extracción de Datos de Documentos',
                description: 'Automatizamos la lectura y procesamiento de facturas, contratos o reportes para eliminar la entrada manual de datos.'
            },
            {
                icon: <BarChart3 className="h-7 w-7 md:h-8 md:w-8" />,
                title: 'Generación Automática de Reportes',
                description: 'Configuramos scripts que consolidan datos de múltiples fuentes (Excel, BBDD, APIs) en informes listos para analizar.'
            },
            {
                icon: <MailCheck className="h-7 w-7 md:h-8 md:w-8" />,
                title: 'Workflows de Email Marketing',
                description: 'Diseñamos flujos automatizados que nutren a tus prospectos y los guían a través del embudo de ventas sin intervención manual.'
            }
        ],
        process: [
            'Auditoría de Procesos Actuales',
            'Identificación de Puntos de Automatización',
            'Desarrollo del Script o Bot',
            'Integración con Sistemas Existentes',
            'Monitoreo y Optimización'
        ]
    },
    {
        slug: 'consultoria',
        icon: <Briefcase className="h-10 w-10 md:h-12 md:w-12 text-cyan-400" />,
        title: 'Consultoría Tecnológica Estratégica',
        description: 'Realizamos una auditoría y digitalización de tu negocio. Desde la transición de procesos administrativos (como la gestión de flotillas o clínicas) hasta el rediseño UI/UX de tus sistemas actuales para mejorar la eficiencia y la experiencia de usuario.',
        features: [
            'Diagnóstico y auditoría de sistemas existentes',
            'Plan de transformación digital',
            'Rediseño de Experiencia de Usuario (UI/UX)',
            'Estrategia de modernización de software',
            'Optimización de procesos de negocio',
            'Capacitación y soporte técnico',
        ],
        useCases: [
            {
                icon: <SearchCode className="h-7 w-7 md:h-8 md:w-8" />,
                title: 'Auditoría de Código y Arquitectura',
                description: 'Analizamos tu software actual para identificar cuellos de botella, vulnerabilidades de seguridad y oportunidades de mejora.'
            },
            {
                icon: <Combine className="h-7 w-7 md:h-8 md:w-8" />,
                title: 'Digitalización de Operaciones',
                description: 'Transformamos procesos manuales y en papel a sistemas digitales eficientes, desde la gestión de inventario hasta la administración de clientes.'
            },
            {
                icon: <Palette className="h-7 w-7 md:h-8 md:w-8" />,
                title: 'Rediseño UI/UX de Sistemas Legados',
                description: 'Modernizamos la interfaz y experiencia de tus aplicaciones existentes para aumentar la productividad y satisfacción del usuario.'
            },
            {
                icon: <Users className="h-7 w-7 md:h-8 md:w-8" />,
                title: 'Capacitación y Adopción Tecnológica',
                description: 'Acompañamos a tu equipo en la transición, asegurando que aprovechen al máximo las nuevas herramientas implementadas.'
            }
        ],
        process: [
            'Diagnóstico 360° del Negocio',
            'Hoja de Ruta Tecnológica',
            'Selección de Herramientas y KPIs',
            'Gestión del Cambio Organizacional',
            'Medición de Impacto y ROI'
        ]
    },
];

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.2,
      duration: 0.8,
      ease: 'easeOut',
    },
  }),
};

export default function ServiceDetailClient({ slug }: { slug: string }) {
  const service = servicesData.find(s => s.slug === slug);

  if (!service) {
    notFound();
  }

  return (
    <>
    <ServiceStructuredData slug={service.slug} title={service.title} description={service.description} />
    <div className="min-h-screen bg-[#030303] text-white pt-32 sm:pt-40 pb-16 sm:pb-24">
      <Header />
      <main className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          animate="visible"
          custom={0}
          variants={sectionVariants}
          className="mb-8 md:mb-10"
        >
          <Link
            href="/services"
            className="group inline-flex items-center font-medium text-zinc-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="mr-2 h-5 w-5 transition-transform group-hover:-translate-x-1" />
            Volver a Servicios
          </Link>
        </motion.div>

        <motion.section
          initial="hidden"
          animate="visible"
          custom={1}
          variants={sectionVariants}
          className="mb-16 rounded-2xl border border-white/10 bg-[#0A0A0A] p-8 md:p-12 shadow-[0_0_40px_rgba(0,240,255,0.05)]"
        >
          <div className="flex flex-col sm:flex-row items-center text-center sm:text-left gap-6 md:gap-8">
            <div className="mb-4 sm:mb-0">{service.icon}</div>
            <div className="flex-1">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
                {service.title}
                </h1>
                <p className="mt-4 max-w-3xl text-base md:text-lg text-white/70 leading-relaxed">
                {service.description}
                </p>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          custom={2}
          variants={sectionVariants}
          className="py-12 sm:py-16"
        >
          <h2 className="mb-10 md:mb-12 text-center text-3xl font-bold text-white">
            Beneficios Clave
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-6">
            {service.features.map((feature, index) => (
              <div
                key={index}
                className="flex items-start gap-4 rounded-lg border border-white/10 bg-[#0A0A0A] p-5"
              >
                <CheckCircle className="mt-1 h-5 w-5 flex-shrink-0 text-cyan-400" />
                <p className="text-white/80">{feature}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={sectionVariants}
            className="py-12 sm:py-16"
        >
            <h2 className="mb-10 md:mb-12 text-center text-3xl font-bold text-white">
                Casos de Uso y Aplicaciones
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
                {service.useCases.map((useCase, index) => (
                    <div key={index} className="flex gap-6 rounded-xl border border-white/5 bg-[#0A0A0A] p-6 transition-all duration-300 hover:border-cyan-500/20 hover:-translate-y-1">
                        <div className="mt-1 text-cyan-400 flex-shrink-0">{useCase.icon}</div>
                        <div>
                            <h3 className="font-bold text-white text-lg">{useCase.title}</h3>
                            <p className="mt-2 text-sm text-white/60 leading-relaxed">{useCase.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </motion.section>

        <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={sectionVariants}
            className="py-12 sm:py-16"
        >
            <h2 className="mb-10 md:mb-12 text-center text-3xl font-bold text-white">
                Nuestro Proceso
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
                {service.process.map((step, index) => (
                    <div key={index} className="relative rounded-xl border border-white/10 bg-[#0A0A0A] p-6 md:p-8 overflow-hidden text-center md:text-left">
                        <span className="absolute -top-2 -right-2 md:-top-4 md:-right-4 text-6xl md:text-8xl font-extrabold text-cyan-500/5">
                            {`0${index + 1}`}
                        </span>
                        <p className="relative z-10 text-base md:text-lg font-semibold text-white">{step}</p>
                    </div>
                ))}
            </div>
        </motion.section>

        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
          variants={sectionVariants}
          className="mt-12 mb-8 md:mb-16 rounded-2xl bg-gradient-to-tr from-cyan-950/50 via-[#0A0A0A] to-[#0A0A0A] border border-white/10 py-12 md:py-16 px-6 text-center shadow-[0_0_40px_rgba(0,240,255,0.05)]"
        >
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            ¿Listo para escalar tu operación?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/60 leading-relaxed">
            Agendemos una consultoría gratuita para analizar tus necesidades y diseñar una solución a la medida.
          </p>
          <div className="mt-8">
            <Link href="/contact">
              <ShinyButton className="w-full sm:w-auto">Agendar Consultoría Gratuita</ShinyButton>
            </Link>
          </div>
        </motion.section>
      </main>
      <Footer />
    </div>
    </>
  );
}
