'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  MessageSquareText,
  FileScan,
  BarChart3,
  MailCheck,
  Factory,
  Building2,
} from 'lucide-react';
import Header from '@/components/header';
import { Footer } from '@/components/ui/footer-section';
import { ShinyButton } from '@/components/ui/shiny-button';
import type { LocalCity } from '@/lib/content/automatizacion-local';
import { LOCAL_AUTOMATION_CITIES } from '@/lib/content/automatizacion-local';

const ICONS = {
  MessageSquareText,
  FileScan,
  BarChart3,
  MailCheck,
  Factory,
  Building2,
} as const;

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.7, ease: 'easeOut' as const },
  }),
};

const PROCESS_STEPS = [
  'Diagnóstico gratuito de tus procesos actuales',
  'Diseño e implementación del bot, script o flujo',
  'Monitoreo, ajuste y soporte continuo',
];

export default function LocalAutomationPage({ city }: { city: LocalCity }) {
  const neighbors = city.neighborSlugs
    .map((slug) => LOCAL_AUTOMATION_CITIES.find((c) => c.slug === slug))
    .filter((c): c is LocalCity => Boolean(c));

  return (
    <div className="min-h-screen bg-background text-foreground pt-32 sm:pt-40 pb-16 sm:pb-24">
      <Header />
      <main className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div initial="hidden" animate="visible" custom={0} variants={sectionVariants} className="mb-8 md:mb-10">
          <Link
            href="/services/automatizacion"
            className="group inline-flex items-center font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-5 w-5 transition-transform group-hover:-translate-x-1" />
            Volver a Automatización de Procesos
          </Link>
        </motion.div>

        {/* Hero: único H1 de la página */}
        <motion.section
          initial="hidden"
          animate="visible"
          custom={1}
          variants={sectionVariants}
          className="mb-16 rounded-2xl border border-border bg-card p-8 md:p-12 shadow-sm dark:shadow-[0_0_40px_rgba(0,240,255,0.05)]"
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary dark:text-cyan-400">
            {city.city}, {city.region}
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            {city.h1}
          </h1>
          <p className="mt-4 max-w-3xl text-base md:text-lg text-muted-foreground leading-relaxed">
            {city.intro}
          </p>
        </motion.section>

        {/* Contexto local — contenido único por ciudad, no doorway page */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={sectionVariants}
          className="py-12 sm:py-16"
        >
          <h2 className="mb-6 text-3xl font-bold text-foreground">{city.contextTitle}</h2>
          <div className="space-y-4 max-w-3xl">
            {city.contextBody.map((paragraph, index) => (
              <p key={index} className="text-muted-foreground leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            {city.externalSources.map((source) => (
              <a
                key={source.href}
                href={source.href}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center font-medium text-primary dark:text-cyan-400 hover:underline"
              >
                Fuente: {source.label} →
              </a>
            ))}
          </div>
        </motion.section>

        {/* Casos de uso */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={sectionVariants}
          className="py-12 sm:py-16"
        >
          <h2 className="mb-10 md:mb-12 text-center text-3xl font-bold text-foreground">
            Casos de uso en {city.city}
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            {city.useCases.map((useCase, index) => {
              const Icon = ICONS[useCase.icon];
              return (
                <div
                  key={index}
                  className="flex gap-6 rounded-xl border border-border/60 bg-card p-6 transition-all duration-300 hover:border-primary/20 dark:hover:border-cyan-500/20 hover:-translate-y-1"
                >
                  <div className="mt-1 text-primary dark:text-cyan-400 flex-shrink-0">
                    <Icon className="h-7 w-7 md:h-8 md:w-8" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-lg">{useCase.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{useCase.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* Proceso — mismo proceso real en todas las ciudades */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={sectionVariants}
          className="py-12 sm:py-16"
        >
          <h2 className="mb-10 md:mb-12 text-center text-3xl font-bold text-foreground">Cómo trabajamos</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
            {PROCESS_STEPS.map((step, index) => (
              <div
                key={index}
                className="relative rounded-xl border border-border bg-card p-6 md:p-8 overflow-hidden text-center md:text-left"
              >
                <span className="absolute -top-2 -right-2 md:-top-4 md:-right-4 text-6xl md:text-8xl font-extrabold text-primary/5 dark:text-cyan-500/5">
                  {`0${index + 1}`}
                </span>
                <p className="relative z-10 text-base md:text-lg font-semibold text-foreground">{step}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* FAQ — texto idéntico al FAQPage schema que emite el page.tsx */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={sectionVariants}
          className="py-12 sm:py-16"
        >
          <h2 className="mb-10 md:mb-12 text-center text-3xl font-bold text-foreground">
            Preguntas frecuentes
          </h2>
          <div className="mx-auto max-w-3xl space-y-6">
            {city.faq.map((item, index) => (
              <div key={index} className="rounded-xl border border-border bg-card p-6">
                <h3 className="font-bold text-foreground text-lg">{item.q}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* CTA */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
          variants={sectionVariants}
          className="mt-12 mb-8 md:mb-16 rounded-2xl bg-gradient-to-tr from-primary/5 via-card to-card border border-border py-12 md:py-16 px-6 text-center shadow-sm dark:from-cyan-950/50 dark:via-[#0A0A0A] dark:to-[#0A0A0A] dark:shadow-[0_0_40px_rgba(0,240,255,0.05)]"
        >
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            ¿Listo para automatizar en {city.city}?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground leading-relaxed">
            Agendemos un diagnóstico gratuito para ver exactamente qué procesos conviene automatizar primero.
          </p>
          <div className="mt-8">
            <ShinyButton href="/contact" className="w-full sm:w-auto">Hablar con un especialista</ShinyButton>
          </div>
        </motion.section>

        {/* Cobertura — cross-link a ciudades vecinas, internal linking contextual */}
        {neighbors.length > 0 && (
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.5 }}
            variants={sectionVariants}
            className="mb-8 text-center"
          >
            <p className="text-sm text-muted-foreground">
              También automatizamos procesos en{' '}
              {neighbors.map((n, i) => (
                <span key={n.slug}>
                  <Link href={`/${n.slug}`} className="font-medium text-primary dark:text-cyan-400 hover:underline">
                    {n.city}
                  </Link>
                  {i < neighbors.length - 1 ? ' y ' : ''}
                </span>
              ))}
              . Conoce el servicio completo en{' '}
              <Link href="/services/automatizacion" className="font-medium text-primary dark:text-cyan-400 hover:underline">
                Automatización de Procesos con IA
              </Link>
              .
            </p>
          </motion.section>
        )}
      </main>
      <Footer />
    </div>
  );
}
