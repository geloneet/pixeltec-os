'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { motion, useReducedMotion } from 'framer-motion';
import { GlowCard } from './spotlight-card';
import { WhatsappAiAgentBg } from '@/components/services-animations/whatsapp-ai-agent-bg';
import { SiteAppBuildBg } from '@/components/services-animations/site-app-build-bg';
import { ConsultingMascotBg } from '@/components/services-animations/consulting-mascot-bg';

// WO-2026-00275: las fotos de stock (Unsplash) se reemplazan por escenas
// animadas 100 % código, una por servicio. Cada escena arranca sola al entrar
// al viewport y se pausa fuera de pantalla; en el modal se muestra en modo
// `poster` (fotograma final) porque ahí el usuario lee y decide.
const SCENES: Record<string, React.ComponentType<{ poster?: boolean }>> = {
  automatizacion: WhatsappAiAgentBg,
  'ecosistemas-web': SiteAppBuildBg,
  consultoria: ConsultingMascotBg,
};

// --- Data for the image accordion ---
interface AccordionItemData {
  id: number;
  title: string;
  slug: string;
  preview: string;
  bullets: string[];
}

const accordionItems: AccordionItemData[] = [
  {
    id: 1,
    title: 'Automatización con IA',
    slug: 'automatizacion',
    preview:
      'Eliminamos tareas repetitivas con bots, scripts e IA aplicada a tu operación diaria. Conectamos sistemas que no se hablaban y liberamos horas-hombre.',
    bullets: [
      'Bots de Telegram y WhatsApp para flujos internos',
      'Scripts Python que automatizan reportes y conciliaciones',
      'IA aplicada (Claude, GPT) integrada a tu stack actual',
      'Webhooks y APIs que orquestan tus herramientas',
    ],
  },
  {
    id: 2,
    title: 'Desarrollo Web & Apps',
    slug: 'ecosistemas-web',
    preview:
      'Ecosistemas web robustos, CRMs hechos a la medida y portales corporativos ultra rápidos. Next.js, React y Firebase como fundamento.',
    bullets: [
      'CRMs y ERPs internos a la medida',
      'Sitios corporativos optimizados para SEO',
      'Portales B2B y apps con autenticación segura',
      'Integración con servicios externos (Stripe, Resend, Firebase)',
    ],
  },
  {
    id: 3,
    title: 'Consultoría & Soporte TI',
    slug: 'consultoria',
    preview:
      'Diagnóstico estratégico, transformación digital y rediseño UI/UX para modernizar procesos. Acompañamos a tu equipo de adentro hacia afuera.',
    bullets: [
      'Diagnóstico tecnológico y plan de modernización',
      'Rediseño UI/UX con foco en conversión',
      'Acompañamiento continuo y soporte operativo',
      'Auditoría de seguridad y mejoras de performance',
    ],
  },
];

// --- Service Card ---
interface ServiceCardProps {
  item: AccordionItemData;
  onClick: () => void;
  index?: number;
}

const ServiceCard = ({ item, onClick, index = 0 }: ServiceCardProps) => {
  const reduceMotion = useReducedMotion();
  const Scene = SCENES[item.slug];

  return (
    <motion.div
      className="h-full"
      // REN-01 (WO-2026-00268): las tres tarjetas de servicio de la home
      // salían del servidor con opacity: 0 y sólo aparecían al hidratar.
      // Ahora sólo se anima transform.
      initial={reduceMotion ? false : { y: 30 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.5, delay: index * 0.15 }}
    >
      {/* !p-0, !gap-0 y !border-0 anulan relleno, hueco interno y filete de
          GlowCard: la imagen ocupa el 100 % de la tarjeta. El halo del glow se
          dibuja fuera del borde, así que se conserva. */}
      <GlowCard customSize glowColor="cyan" className="group h-full w-full !p-0 !gap-0 !border-0">
        {/* La escena animada es el fondo de toda la tarjeta; el texto va encima. */}
        <div className="relative flex h-full min-h-[26rem] w-full flex-col justify-end overflow-hidden rounded-2xl">
          <Scene />
          {/* Refuerzo de contraste tras el texto, que va abajo. Mismo negro
              frío de la escena (#06080d) para que el fundido sea invisible. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-[#06080d] via-[#06080d]/85 to-transparent"></div>

          <div className="relative flex flex-col gap-2 p-6">
            <h3 className="text-xl font-semibold leading-tight text-white">
              {/* Botón estirado: la tarjeta entera es clicable, pero el elemento
                  accesible es un <button> real con nombre propio. */}
              <button
                type="button"
                onClick={onClick}
                className="text-left after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-cyan-400"
              >
                {item.title}
              </button>
            </h3>
            <p className="text-sm font-light leading-relaxed tracking-wide text-white/80">
              {item.preview}
            </p>
          </div>
        </div>
      </GlowCard>
    </motion.div>
  );
};

// --- Main App Component ---
export function LandingAccordionItem() {
  const [openItem, setOpenItem] = useState<AccordionItemData | null>(null);

  return (
    <div className="bg-transparent font-sans">
      <section id="services" className="container mx-auto px-4 py-12 md:py-24">
        {/* Encabezado centrado */}
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-4xl md:text-6xl font-bold text-foreground leading-tight tracking-tighter">
            Servicios Diseñados para el{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand to-cyan-700 dark:from-cyan-500 dark:to-blue-500">
              Futuro
            </span>
          </h2>
          <p className="mt-6 text-lg text-muted-foreground font-light tracking-wide">
            Impulsamos tu transformación digital con soluciones de vanguardia. Desde inteligencia artificial hasta arquitecturas web de alto rendimiento y soporte empresarial.
          </p>
        </div>

        {/* Tres tarjetas en fila; se apilan en móvil y pasan a dos en tablet */}
        {/* Rejilla asimétrica: la primera tarjeta ocupa dos filas a la izquierda
            y las otras dos se apilan a su derecha. */}
        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3 md:mt-16">
          {accordionItems.map((item, index) => (
            <ServiceCard
              key={item.id}
              item={item}
              index={index}
              onClick={() => setOpenItem(item)}
            />
          ))}
        </div>
      </section>

      {/* Service preview modal */}
      <Dialog open={!!openItem} onOpenChange={(o) => !o && setOpenItem(null)}>
        <DialogContent
          className="max-w-3xl gap-0 overflow-hidden border-border bg-card/95 p-0 shadow-2xl shadow-black/10 backdrop-blur-2xl sm:rounded-2xl
            dark:border-white/10 dark:bg-zinc-950/85 dark:shadow-black/60
            [&>button]:right-5 [&>button]:top-5 [&>button]:z-20 [&>button]:flex [&>button]:h-8 [&>button]:w-8 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:border [&>button]:border-border [&>button]:bg-background/70 [&>button]:text-muted-foreground [&>button]:opacity-100 [&>button]:backdrop-blur-md [&>button:hover]:border-primary/40 [&>button:hover]:text-foreground
            dark:[&>button]:border-white/15 dark:[&>button]:bg-black/40 dark:[&>button]:text-white/70 dark:[&>button:hover]:border-cyan-400/40 dark:[&>button:hover]:text-white"
        >
          {openItem && (
            <div className="grid md:grid-cols-[0.8fr_1fr]">
              {/* Escena lateral en modo poster (fotograma final, sin timers):
                  aquí el usuario lee bullets y decide — lo que se lee no se
                  mueve. */}
              <div className="relative h-44 overflow-hidden md:h-auto md:min-h-[26rem]">
                {(() => {
                  const ModalScene = SCENES[openItem.slug];
                  return <ModalScene poster />;
                })()}
                {/* Fundido hacia el panel: vertical en móvil, horizontal en escritorio */}
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent md:bg-gradient-to-r md:from-transparent md:via-card/10 md:to-card dark:from-zinc-950 dark:via-zinc-950/30 dark:md:via-zinc-950/10 dark:md:to-zinc-950" />
              </div>

              {/* Panel de contenido */}
              <div className="relative flex flex-col gap-5 p-7 md:p-9">
                {/* Halo tenue de marca */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl dark:bg-cyan-400/10"
                />

                <div className="relative space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brand dark:text-cyan-400">
                    Servicio
                  </p>
                  <DialogTitle className="text-2xl font-bold tracking-tight text-foreground dark:text-white md:text-3xl">
                    {openItem.title}
                  </DialogTitle>
                  <DialogDescription className="text-sm leading-relaxed text-muted-foreground dark:text-white/60">
                    {openItem.preview}
                  </DialogDescription>
                </div>

                <div className="h-px w-full bg-gradient-to-r from-primary/40 via-border to-transparent dark:from-cyan-400/40 dark:via-white/10" />

                <ul className="relative grid gap-3">
                  {openItem.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-3 text-sm text-foreground/85 dark:text-white/80">
                      <span
                        aria-hidden="true"
                        className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary dark:bg-cyan-400 dark:shadow-[0_0_8px_rgba(34,211,238,0.9)]"
                      />
                      <span className="leading-relaxed">{b}</span>
                    </li>
                  ))}
                </ul>

                <div className="relative mt-auto flex flex-wrap items-center gap-3 pt-2">
                  <Link
                    href={`/services/${openItem.slug}`}
                    className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-black px-5 py-2.5 text-sm font-semibold text-white transition-all hover:border-primary/50 hover:shadow-[0_8px_24px_-8px_rgba(33,150,243,0.45)] dark:hover:border-cyan-400/40 dark:hover:shadow-[0_0_28px_-6px_rgba(34,211,238,0.55)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    Conocer más
                    <span
                      aria-hidden="true"
                      className="transition-transform duration-300 group-hover:translate-x-1"
                    >
                      →
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setOpenItem(null)}
                    className="rounded-full px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground dark:text-white/50 dark:hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
