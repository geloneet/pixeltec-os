'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { motion, useReducedMotion } from 'framer-motion';
import { GlowCard } from './spotlight-card';

// --- Data for the image accordion ---
interface AccordionItemData {
  id: number;
  title: string;
  slug: string;
  imageUrl: string;
  preview: string;
  bullets: string[];
}

const accordionItems: AccordionItemData[] = [
  {
    id: 1,
    title: 'Automatización con IA',
    slug: 'automatizacion',
    imageUrl:
      'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=2070&auto=format&fit=crop',
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
    imageUrl:
      'https://images.unsplash.com/photo-1547658719-da2b51169166?q=80&w=2070&auto=format&fit=crop',
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
    imageUrl:
      'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=2070&auto=format&fit=crop',
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

  return (
    <motion.div
      className="h-full"
      initial={reduceMotion ? false : { opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.5, delay: index * 0.15 }}
    >
      {/* !p-0, !gap-0 y !border-0 anulan relleno, hueco interno y filete de
          GlowCard: la imagen ocupa el 100 % de la tarjeta. El halo del glow se
          dibuja fuera del borde, así que se conserva. */}
      <GlowCard customSize glowColor="cyan" className="group h-full w-full !p-0 !gap-0 !border-0">
        {/* La imagen es el fondo de toda la tarjeta; el texto va encima. */}
        <div className="relative flex h-full min-h-[26rem] w-full flex-col justify-end overflow-hidden rounded-2xl">
          <Image
            src={item.imageUrl}
            alt={item.title}
            fill
            sizes="(max-width: 1024px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          {/* Dark overlay for better text readability */}
          <div className="absolute inset-0 bg-black bg-opacity-50 transition-opacity duration-300 group-hover:bg-opacity-40"></div>
          {/* Refuerzo de contraste tras el texto, que va abajo */}
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 to-transparent"></div>

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
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-500">
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
          className="max-w-3xl gap-0 overflow-hidden border-white/10 bg-zinc-950/85 p-0 shadow-2xl shadow-black/60 backdrop-blur-2xl sm:rounded-2xl
            [&>button]:right-5 [&>button]:top-5 [&>button]:z-20 [&>button]:flex [&>button]:h-8 [&>button]:w-8 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:border [&>button]:border-white/15 [&>button]:bg-black/40 [&>button]:text-white/70 [&>button]:opacity-100 [&>button]:backdrop-blur-md [&>button:hover]:border-cyan-400/40 [&>button:hover]:text-white"
        >
          {openItem && (
            <div className="grid md:grid-cols-[0.8fr_1fr]">
              {/* Imagen lateral, a sangre */}
              <div className="relative h-44 md:h-auto">
                <Image
                  src={openItem.imageUrl}
                  alt={openItem.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 340px"
                  className="object-cover"
                />
                {/* Fundido hacia el panel: vertical en móvil, horizontal en escritorio */}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent md:bg-gradient-to-r md:from-transparent md:via-zinc-950/10 md:to-zinc-950" />
              </div>

              {/* Panel de contenido */}
              <div className="relative flex flex-col gap-5 p-7 md:p-9">
                {/* Halo tenue de marca */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl"
                />

                <div className="relative space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-400">
                    Servicio
                  </p>
                  <DialogTitle className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                    {openItem.title}
                  </DialogTitle>
                  <DialogDescription className="text-sm leading-relaxed text-white/60">
                    {openItem.preview}
                  </DialogDescription>
                </div>

                <div className="h-px w-full bg-gradient-to-r from-cyan-400/40 via-white/10 to-transparent" />

                <ul className="relative grid gap-3">
                  {openItem.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-3 text-sm text-white/80">
                      <span
                        aria-hidden="true"
                        className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]"
                      />
                      <span className="leading-relaxed">{b}</span>
                    </li>
                  ))}
                </ul>

                <div className="relative mt-auto flex flex-wrap items-center gap-3 pt-2">
                  <Link
                    href={`/services/${openItem.slug}`}
                    className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-black px-5 py-2.5 text-sm font-semibold text-white transition-all hover:border-cyan-400/40 hover:shadow-[0_0_28px_-6px_rgba(34,211,238,0.55)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
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
                    className="rounded-full px-4 py-2.5 text-sm text-white/50 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
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
