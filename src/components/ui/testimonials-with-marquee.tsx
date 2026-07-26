'use client';

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils"
import { useReducedMotion } from "framer-motion";
import { TestimonialCard } from "@/components/ui/testimonial-card"
import type { TestimonialAuthor } from "@/components/ui/testimonial-card"

type Testimonial = {
  author: TestimonialAuthor
  text: string
  href?: string
}

interface TestimonialsSectionProps {
  /** ReactNode para permitir resaltar palabras dentro del título. */
  title: React.ReactNode
  description: string
  testimonials: Testimonial[]
  className?: string
}

/** A partir de esta cantidad el marquee aporta algo; por debajo, una fila estática lee mejor. */
const MARQUEE_MIN_ITEMS = 4;

export function TestimonialsWithMarquee({
  title,
  description,
  testimonials,
  className
}: TestimonialsSectionProps) {
  const reduceMotion = useReducedMotion();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [interacting, setInteracting] = useState(false);

  const animated = !reduceMotion && testimonials.length >= MARQUEE_MIN_ITEMS;

  // La animación solo corre mientras la sección está en pantalla.
  useEffect(() => {
    const node = viewportRef.current;
    if (!node || !animated) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [animated]);

  // Sin testimonios no hay prueba social que mostrar.
  if (testimonials.length === 0) return null;

  const header = (
    <div className="flex flex-col items-center gap-4 px-4 sm:gap-6">
      <h2 className="max-w-[720px] text-4xl font-bold leading-tight sm:text-6xl sm:leading-tight tracking-tight text-foreground">
        {title}
      </h2>
      <p className="text-md max-w-[600px] font-light text-muted-foreground sm:text-xl tracking-wide">
        {description}
      </p>
    </div>
  );

  const cards = (clone: boolean) =>
    testimonials.map((testimonial) => (
      <TestimonialCard
        key={`${clone ? 'clone' : 'item'}-${testimonial.author.name}`}
        {...testimonial}
        className="shrink-0 mr-6"
      />
    ));

  const sectionClasses = cn(
    "bg-background dark:bg-[#030303] text-foreground",
    "py-16 sm:py-24 md:py-32 px-0",
    className
  );

  // Estático: pocas tarjetas o movimiento reducido. Mismo contenido, sin animación.
  if (!animated) {
    return (
      <section className={sectionClasses}>
        <div className="mx-auto flex w-full flex-col items-center gap-6 text-center sm:gap-16">
          {header}
          <ul className="mt-8 flex w-full max-w-6xl flex-wrap justify-center gap-6 px-4">
            {testimonials.map((testimonial) => (
              <li key={testimonial.author.name} className="flex">
                <TestimonialCard {...testimonial} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  const paused = interacting || !inView;

  return (
    <section className={sectionClasses}>
      <style jsx>{`
        /* Cada tarjeta lleva su propio margen derecho, así el ancho total es
           exactamente 2x el de un grupo y el reinicio en -50% no salta. */
        .marquee-track {
          display: flex;
          width: max-content;
          animation: marquee-scroll 35s linear infinite;
        }
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .marquee-track[data-paused='true'] {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track { animation: none; }
        }
      `}</style>

      <div className="mx-auto flex w-full flex-col items-center gap-6 text-center sm:gap-16">
        {header}

        <div
          ref={viewportRef}
          role="region"
          aria-label="Testimonios de clientes"
          tabIndex={0}
          onMouseEnter={() => setInteracting(true)}
          onMouseLeave={() => setInteracting(false)}
          onFocus={() => setInteracting(true)}
          onBlur={() => setInteracting(false)}
          className="relative mt-8 w-full overflow-hidden rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          style={{ maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' }}
        >
          <div className="marquee-track p-2" data-paused={paused}>
            <div className="flex">{cards(false)}</div>
            {/* Copia visual: invisible para lectores de pantalla y fuera del
                orden de tabulación, incluidos sus descendientes. */}
            <div className="flex" aria-hidden="true" inert>
              {cards(true)}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
