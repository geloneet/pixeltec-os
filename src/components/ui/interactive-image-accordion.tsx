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
import { HOME_SERVICES_INTRO } from '@/lib/content/home';
import { ServiceScene } from '@/components/services-animations/registry';

// WO-2026-00275: las fotos de stock (Unsplash) se reemplazan por escenas
// animadas 100 % código, una por servicio. Cada escena arranca sola al entrar
// al viewport y se pausa fuera de pantalla. El mapeo slug → escena vive en
// services-animations/registry.tsx (WO-2026-00341), compartido con el modal,
// /services y /services/[slug].

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
          <ServiceScene slug={item.slug} />
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
{HOME_SERVICES_INTRO}
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

      {/* Modal de servicio (WO-2026-00341). Antes: escena en modo poster,
          encajonada en una columna de 0.8fr con fundido lateral — se veía
          recortada y pobre. Ahora la escena es el escenario: corre viva a todo
          el ancho, arriba, con altura generosa y escalada con zoom; el texto va
          debajo con aire (jerarquía Apple: primero el producto, luego la
          lectura). Bajo prefers-reduced-motion la escena se queda en su
          fotograma final (lo resuelve useSceneActive, no hace falta `poster`). */}
      <Dialog open={!!openItem} onOpenChange={(o) => !o && setOpenItem(null)}>
        <DialogContent
          className="w-[calc(100%-1.5rem)] max-w-[52rem] gap-0 overflow-hidden overflow-y-auto rounded-[24px] border-border bg-card p-0 shadow-2xl shadow-black/20 max-h-[calc(100dvh-1.5rem)] before:hidden sm:w-full sm:rounded-[28px]
            dark:border-white/10 dark:bg-zinc-950 dark:shadow-black/70
            [&>button]:right-4 [&>button]:top-4 [&>button]:z-20 [&>button]:flex [&>button]:h-9 [&>button]:w-9 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:border [&>button]:border-white/15 [&>button]:bg-white/10 [&>button]:text-white/80 [&>button]:opacity-100 [&>button]:transition-colors [&>button:hover]:border-white/25 [&>button:hover]:bg-white/20 [&>button:hover]:text-white [&>button]:focus-visible:ring-cyan-400/60"
        >
          {openItem && (
            <div className="flex flex-col">
              {/* Escenario: la escena a sangre, arriba, a todo el ancho. */}
              {/* En laptops bajas (≤ 760 px de alto útil) el escenario cede altura y
                  zoom para que título, bullets y CTA queden a la vista sin scroll. */}
              <div className="relative h-[256px] shrink-0 overflow-hidden bg-[#06080d] sm:h-[312px] md:h-[352px] md:[@media(max-height:760px)]:h-[248px]">
                <ServiceScene
                  key={openItem.slug}
                  slug={openItem.slug}
                  layout="stage"
                  stageClassName="sm:[zoom:1.12] md:[zoom:1.26] md:[@media(max-height:760px)]:[zoom:1]"
                />
              </div>

              {/* Lectura: título, descripción, bullets y decisión. */}
              <div className="relative flex flex-col gap-6 px-6 pb-6 pt-7 sm:px-9 sm:pb-8 sm:pt-8 md:px-11 md:[@media(max-height:760px)]:gap-5 md:[@media(max-height:760px)]:pb-6 md:[@media(max-height:760px)]:pt-6">
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brand dark:text-cyan-400">
                    Servicio
                  </p>
                  <DialogTitle className="text-2xl font-semibold tracking-tight text-foreground dark:text-white sm:text-3xl md:text-[2rem] md:leading-[1.15]">
                    {openItem.title}
                  </DialogTitle>
                  <DialogDescription className="max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground dark:text-white/60">
                    {openItem.preview}
                  </DialogDescription>
                </div>

                <ModalBullets key={openItem.slug} bullets={openItem.bullets} />

                <div className="flex flex-wrap items-center gap-3 border-t border-border/70 pt-5 dark:border-white/10">
                  <Link
                    href={`/services/${openItem.slug}`}
                    className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-black px-5 py-2.5 text-sm font-semibold text-white transition-[border-color,box-shadow,transform] duration-200 hover:border-primary/50 hover:shadow-[0_8px_24px_-8px_rgba(33,150,243,0.45)] active:scale-[0.97] dark:hover:border-cyan-400/40 dark:hover:shadow-[0_0_28px_-6px_rgba(34,211,238,0.55)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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
                  {/* Honestidad de la simulación: la escena usa datos ficticios. */}
                  <span className="ml-auto text-[11px] text-muted-foreground/80 dark:text-white/35">
                    Escena simulada con datos ficticios
                  </span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Bullets del modal con entrada escalonada (40 ms entre cada uno, spring sin
 * rebote): el ojo llega a la lista justo cuando el modal termina de abrir.
 * Con prefers-reduced-motion no hay desplazamiento: la lista aparece tal cual.
 */
function ModalBullets({ bullets }: { bullets: string[] }) {
  const reduceMotion = useReducedMotion();
  return (
    <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {bullets.map((b, i) => (
        <motion.li
          key={b}
          className="flex items-start gap-3 text-sm text-foreground/85 dark:text-white/80"
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.45, bounce: 0, delay: 0.12 + i * 0.04 }}
        >
          <span
            aria-hidden="true"
            className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary dark:bg-cyan-400 dark:shadow-[0_0_8px_rgba(34,211,238,0.9)]"
          />
          <span className="leading-relaxed">{b}</span>
        </motion.li>
      ))}
    </ul>
  );
}
