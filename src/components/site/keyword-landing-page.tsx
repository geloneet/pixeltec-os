'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  AppWindow,
  BarChart3,
  BedDouble,
  Bot,
  Boxes,
  Building2,
  CalendarCheck,
  ClipboardList,
  Clock,
  Code2,
  Cpu,
  CreditCard,
  Database,
  Factory,
  FileScan,
  FileText,
  Globe,
  Handshake,
  Headset,
  HeartPulse,
  Layers,
  LayoutDashboard,
  MailCheck,
  MapPin,
  Megaphone,
  MessageSquareText,
  PlaneTakeoff,
  Repeat,
  Rocket,
  Route,
  Search,
  Send,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Store,
  Tablet,
  Ticket,
  Timer,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Workflow,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Header from '@/components/header';
import { Footer } from '@/components/ui/footer-section';
import { ShinyButton } from '@/components/ui/shiny-button';
import type { KeywordLanding, KeywordLandingIcon } from '@/lib/content/keyword-landings';
import { KEYWORD_LANDING_HUBS, getRelatedLandings } from '@/lib/content/keyword-landings';

/**
 * Plantilla compartida de las landings por keyword (WO-2026-00189).
 *
 * Mismo sistema visual que `local-service-page.tsx` — deliberadamente: es la
 * plantilla que ya pasó QA en las 12 landings de ciudad
 * (`docs/seo/plan-seo-local-automatizacion.md`) y no tiene sentido mantener
 * dos estilos para páginas hermanas.
 *
 * Outline (playbook `estructura-contenido-seo`): un solo H1 (el hero), H2 por
 * sección de contenido y H3 únicamente DENTRO de una sección (bullets, casos
 * de uso, preguntas). Nada de UI en el outline: el back-link, el CTA y el
 * bloque de relacionadas no introducen encabezados fuera de esa jerarquía.
 */

const ICONS: Record<KeywordLandingIcon, LucideIcon> = {
  MessageSquareText,
  FileScan,
  BarChart3,
  MailCheck,
  Factory,
  Building2,
  Bot,
  Workflow,
  Clock,
  Users,
  ShoppingCart,
  CalendarCheck,
  Send,
  Sparkles,
  Code2,
  Smartphone,
  Globe,
  LayoutDashboard,
  Boxes,
  ClipboardList,
  Headset,
  HeartPulse,
  UtensilsCrossed,
  BedDouble,
  PlaneTakeoff,
  Repeat,
  CreditCard,
  Store,
  Timer,
  TrendingUp,
  ShieldCheck,
  Search,
  Database,
  Layers,
  AppWindow,
  Wrench,
  Rocket,
  FileText,
  Megaphone,
  Route,
  Cpu,
  Tablet,
  MapPin,
  Handshake,
  Ticket,
};

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.7, ease: 'easeOut' as const },
  }),
};

/** El proceso real de PixelTEC — igual en todas las páginas de servicio. */
const PROCESS_STEPS = [
  'Diagnóstico gratuito de tu situación actual',
  'Diseño e implementación a la medida',
  'Entrega, monitoreo y soporte continuo',
];

const CTA_LABEL: Record<KeywordLanding['ctaHref'], string> = {
  '/contact': 'Hablar con un especialista',
  '/diagnostico': 'Empezar el diagnóstico gratuito',
};

export default function KeywordLandingPage({ landing }: { landing: KeywordLanding }) {
  const hub = KEYWORD_LANDING_HUBS[landing.hub];
  const related = getRelatedLandings(landing.slug);

  return (
    <div className="min-h-screen bg-background text-foreground pt-32 sm:pt-40 pb-16 sm:pb-24">
      <Header />
      <main className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div initial="hidden" animate="visible" custom={0} variants={sectionVariants} className="mb-8 md:mb-10">
          <Link
            href={hub.href}
            className="group inline-flex items-center font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-5 w-5 transition-transform group-hover:-translate-x-1" />
            Volver a {hub.label}
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
            {landing.city ? `${landing.city.name}, ${landing.city.region}` : hub.label}
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            {landing.h1}
          </h1>
          <p className="mt-4 max-w-3xl text-base md:text-lg text-muted-foreground leading-relaxed">
            {landing.intro}
          </p>
        </motion.section>

        {/* Secciones de contenido — 2 a 4 H2 con H3 solo dentro de sus listas */}
        {landing.sections.map((section, sectionIndex) => (
          <motion.section
            key={section.title}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            variants={sectionVariants}
            className="py-10 sm:py-14"
          >
            <h2 className="mb-6 text-2xl sm:text-3xl font-bold text-foreground">{section.title}</h2>
            <div className="max-w-3xl space-y-4">
              {section.body.map((paragraph, index) => (
                <p key={index} className="text-muted-foreground leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
            {section.bullets && section.bullets.length > 0 && (
              <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                {section.bullets.map((bullet) => (
                  <li
                    key={bullet.title}
                    className="rounded-xl border border-border/60 bg-card p-5 sm:p-6"
                  >
                    <h3 className="font-bold text-foreground text-base sm:text-lg">{bullet.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{bullet.description}</p>
                  </li>
                ))}
              </ul>
            )}
            {sectionIndex === 0 && landing.hub === 'automatizacion' && (
              <aside className="mt-8 rounded-2xl border border-primary/25 dark:border-cyan-500/25 bg-primary/5 dark:bg-cyan-500/5 p-6 sm:p-8 sm:flex sm:items-center sm:justify-between sm:gap-6">
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">WhatsAgent</span> es nuestro producto para
                  operar todo esto en WhatsApp: atiende, califica y entrega la conversación a tu equipo,
                  implementado y operado por PixelTEC.
                </p>
                <Link
                  href="/pixelbot"
                  className="mt-4 sm:mt-0 inline-flex flex-shrink-0 items-center font-semibold text-primary dark:text-cyan-400 hover:underline"
                >
                  Conocer WhatsAgent →
                </Link>
              </aside>
            )}
          </motion.section>
        ))}

        {/* Contexto local — obligatorio cuando la landing tiene ciudad */}
        {landing.city && landing.localContext && (
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={sectionVariants}
            className="py-10 sm:py-14"
          >
            <h2 className="mb-6 text-2xl sm:text-3xl font-bold text-foreground">
              {landing.localContext.title}
            </h2>
            <div className="max-w-3xl space-y-4">
              {landing.localContext.body.map((paragraph, index) => (
                <p key={index} className="text-muted-foreground leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              {landing.externalSources.map((source) => (
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
        )}

        {/* Casos de uso */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={sectionVariants}
          className="py-10 sm:py-14"
        >
          <h2 className="mb-10 md:mb-12 text-center text-2xl sm:text-3xl font-bold text-foreground">
            {landing.city ? `Casos de uso en ${landing.city.name}` : 'Casos de uso'}
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            {landing.useCases.map((useCase) => {
              const Icon = ICONS[useCase.icon];
              return (
                <div
                  key={useCase.title}
                  className="flex gap-4 sm:gap-6 rounded-xl border border-border/60 bg-card p-6 transition-all duration-300 hover:border-primary/20 dark:hover:border-cyan-500/20 hover:-translate-y-1"
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

        {/* Proceso — el mismo proceso real en todas las páginas de servicio */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={sectionVariants}
          className="py-10 sm:py-14"
        >
          <h2 className="mb-10 md:mb-12 text-center text-2xl sm:text-3xl font-bold text-foreground">
            Cómo trabajamos
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
            {PROCESS_STEPS.map((step, index) => (
              <div
                key={step}
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
          viewport={{ once: true, amount: 0.15 }}
          variants={sectionVariants}
          className="py-10 sm:py-14"
        >
          <h2 className="mb-10 md:mb-12 text-center text-2xl sm:text-3xl font-bold text-foreground">
            Preguntas frecuentes
          </h2>
          <div className="mx-auto max-w-3xl space-y-6">
            {landing.faq.map((item) => (
              <div key={item.q} className="rounded-xl border border-border bg-card p-6">
                <h3 className="font-bold text-foreground text-lg">{item.q}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Fuentes — en las genéricas no hay bloque local que las aloje */}
        {!landing.city && (
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.5 }}
            variants={sectionVariants}
            className="mb-4 flex flex-wrap gap-x-6 gap-y-2"
          >
            {landing.externalSources.map((source) => (
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
          </motion.div>
        )}

        {/* CTA */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
          variants={sectionVariants}
          className="mt-8 mb-8 md:mb-16 rounded-2xl bg-gradient-to-tr from-primary/5 via-card to-card border border-border py-12 md:py-16 px-6 text-center shadow-sm dark:from-cyan-950/50 dark:via-[#0A0A0A] dark:to-[#0A0A0A] dark:shadow-[0_0_40px_rgba(0,240,255,0.05)]"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            ¿Listo para {landing.ctaVerb}
            {landing.city ? ` en ${landing.city.name}` : ''}?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base sm:text-lg text-muted-foreground leading-relaxed">
            Agendemos un diagnóstico gratuito para ver exactamente qué conviene hacer primero.
          </p>
          <div className="mt-8">
            <ShinyButton href={landing.ctaHref} className="w-full sm:w-auto">
              {CTA_LABEL[landing.ctaHref]}
            </ShinyButton>
          </div>
        </motion.section>

        {/* Relacionado — enlazado interno del clúster y de la variante local */}
        {related.length > 0 && (
          <motion.aside
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.4 }}
            variants={sectionVariants}
            className="rounded-2xl border border-border bg-card p-6 sm:p-8"
          >
            <h2 className="text-lg sm:text-xl font-semibold text-foreground">Relacionado</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {related.map((item) => (
                <Link
                  key={item.slug}
                  href={`/${item.slug}`}
                  className="rounded-full border border-primary/25 dark:border-cyan-500/25 bg-primary/5 dark:bg-cyan-500/5 px-4 py-2 text-sm font-medium text-primary dark:text-cyan-400 hover:bg-primary/10 dark:hover:bg-cyan-500/10 transition-colors"
                >
                  {item.keyword}
                  {item.city ? ` en ${item.city.name}` : ''}
                </Link>
              ))}
              <Link
                href={hub.href}
                className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:border-primary/40 dark:hover:border-cyan-500/40 transition-colors"
              >
                {hub.label}
              </Link>
            </div>
          </motion.aside>
        )}
      </main>
      <Footer />
    </div>
  );
}
