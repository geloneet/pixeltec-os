'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { DiagnosticWizard } from '@/components/diagnostico/DiagnosticWizard';

/**
 * Cierre de la home: el visitante completa el ciclo completo del diagnóstico
 * aquí mismo, sin abrir modal ni cambiar de página. Sustituye al formulario de
 * contacto, que deja de existir en el inicio (sigue en /contact).
 *
 * No se toca el wizard: mismos pasos, mismo scoring y mismas server actions.
 * Aquí solo se mide su alto para que el crecimiento de la tarjeta al avanzar
 * de paso sea una transición y no un salto.
 */
export default function DiagnosticInlineSection() {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | 'auto'>('auto');
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setHeight(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="diagnostico" className="bg-transparent py-16 md:py-24">
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <div className="overflow-hidden rounded-3xl bg-card/40 p-6 backdrop-blur-sm md:p-10">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
            {/* ── Columna de contenido y wizard ─────────────────────────── */}
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-primary dark:text-cyan-400">
                Diagnóstico inteligente
              </span>

              <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">
                Cuéntanos qué está{' '}
                <span className="bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
                  frenando
                </span>{' '}
                tu operación
              </h2>
              <p className="mt-4 max-w-md text-base font-light leading-relaxed text-muted-foreground">
                Responde 4 preguntas y comparte tus datos: revisamos tu caso y te proponemos un
                siguiente paso claro, sin soluciones genéricas.
              </p>

              {/* El alto se anima al cambiar de paso: crece, no brinca. */}
              <motion.div
                className="mt-8 overflow-hidden"
                animate={{ height }}
                transition={
                  reduceMotion ? { duration: 0 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }
                }
              >
                <div ref={innerRef}>
                  {/* La sección ya aporta su encabezado, así que el paso de
                      bienvenida solo muestra el microcopy y el botón. */}
                  <DiagnosticWizard variant="page" hideWelcomeHeading />
                </div>
              </motion.div>
            </div>

            {/* ── Columna de imagen ─────────────────────────────────────── */}
            <div className="relative hidden min-h-[24rem] overflow-hidden rounded-2xl lg:block">
              <Image
                src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=2070&auto=format&fit=crop"
                alt="Equipo de PixelTEC trabajando en la operación de un cliente"
                fill
                sizes="(max-width: 1024px) 0px, 50vw"
                className="object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
