'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { ShinyButton } from './shiny-button';

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
      'https://images.unsplash.com/photo-1677756119517-756a188d2d94?q=80&w=2070&auto=format&fit=crop',
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
      'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=2070&auto=format&fit=crop',
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
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=2034&auto=format&fit=crop',
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

// --- Accordion Item Component ---
interface AccordionItemProps {
  item: AccordionItemData;
  isActive: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}

const AccordionItem = ({ item, isActive, onMouseEnter, onClick }: AccordionItemProps) => {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Ver detalle de ${item.title}`}
      className={`
        relative h-[450px] rounded-2xl overflow-hidden cursor-pointer
        transition-all duration-700 ease-in-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background
        ${isActive ? 'w-[400px]' : 'w-[60px]'}
      `}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      {/* Background Image */}
      <Image
        src={item.imageUrl}
        alt={item.title}
        fill
        sizes="400px"
        className="object-cover"
        loading="lazy"
      />
      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 bg-black bg-opacity-50 transition-opacity duration-300 hover:bg-opacity-30"></div>

      {/* Caption Text */}
      <span
        className={`
          absolute text-white text-lg font-semibold whitespace-nowrap
          transition-all duration-300 ease-in-out
          ${
            isActive
              ? 'bottom-6 left-1/2 -translate-x-1/2 rotate-0'
              : 'w-auto text-left bottom-24 left-1/2 -translate-x-1/2 -rotate-90 origin-left'
          }
        `}
      >
        {item.title}
      </span>
    </div>
  );
};

// --- Main App Component ---
export function LandingAccordionItem() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [openItem, setOpenItem] = useState<AccordionItemData | null>(null);

  const handleItemHover = (index: number) => {
    setActiveIndex(index);
  };

  return (
    <div className="bg-transparent font-sans">
      <section id="services" className="container mx-auto px-4 py-12 md:py-24">
        <div className="flex flex-col md:flex-row-reverse items-center justify-between gap-12">
          {/* Left Side: Image Accordion */}
          <div className="w-full md:w-1/2">
            <div className="flex flex-row items-center justify-center gap-4 overflow-x-auto p-4 hidden-scrollbar">
              {accordionItems.map((item, index) => (
                <AccordionItem
                  key={item.id}
                  item={item}
                  isActive={index === activeIndex}
                  onMouseEnter={() => handleItemHover(index)}
                  onClick={() => setOpenItem(item)}
                />
              ))}
            </div>
          </div>

          {/* Right Side: Text Content */}
          <div className="w-full md:w-1/2 text-center md:text-right">
            <h2 className="text-4xl md:text-6xl font-bold text-foreground leading-tight tracking-tighter">
              Servicios Diseñados para el Futuro
            </h2>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto md:ml-auto font-light tracking-wide">
              Impulsamos tu transformación digital con soluciones de vanguardia. Desde inteligencia artificial hasta arquitecturas web de alto rendimiento y soporte empresarial.
            </p>
            <div className="mt-8">
              <ShinyButton
                onClick={() => {
                  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Agendar Diagnóstico
              </ShinyButton>
            </div>
          </div>
        </div>
      </section>

      {/* Service preview modal */}
      <Dialog open={!!openItem} onOpenChange={(o) => !o && setOpenItem(null)}>
        <DialogContent className="max-w-2xl bg-popover/95 backdrop-blur-xl border border-border p-0 overflow-hidden">
          {openItem && (
            <>
              {/* Hero image */}
              <div className="relative h-56 w-full overflow-hidden">
                <Image
                  src={openItem.imageUrl}
                  alt={openItem.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 672px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent dark:from-zinc-950 dark:via-zinc-950/60" />
                <div className="absolute bottom-4 left-6">
                  <DialogTitle className="text-2xl font-bold text-white tracking-tight">
                    {openItem.title}
                  </DialogTitle>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-5">
                <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
                  {openItem.preview}
                </DialogDescription>

                <ul className="space-y-2">
                  {openItem.bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-primary dark:text-cyan-400 mt-0.5" aria-hidden="true">→</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpenItem(null)}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cerrar
                  </button>
                  <a
                    href={`/services/${openItem.slug}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-sm font-semibold transition-all hover:shadow-[0_0_20px_rgba(34,211,238,0.4)]"
                  >
                    Conocer más
                    <span aria-hidden="true">→</span>
                  </a>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
