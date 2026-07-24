'use client';

import { useState } from 'react';
import { ShinyButton } from '@/components/ui/shiny-button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DiagnosticWizard } from '@/components/diagnostico/DiagnosticWizard';

/** CTA principal de conversión — vive entre Benefits y Testimonials. */
export default function DiagnosticCtaSection() {
  const [open, setOpen] = useState(false);

  return (
    <section className="bg-background py-16 dark:bg-[#0A0A0B] md:py-20">
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-10 text-center dark:border-cyan-500/15 dark:bg-cyan-950/[0.07] md:px-12 md:py-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-2/3 rounded-full bg-cyan-500/10 blur-3xl dark:bg-cyan-400/10"
          />
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary dark:text-cyan-400">
            Diagnóstico inteligente
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Encuentra el siguiente paso para tu empresa
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base font-light leading-relaxed text-muted-foreground">
            Responde 5 preguntas y recibe una recomendación inicial según tus procesos, retos y
            objetivos.
          </p>
          <ShinyButton
            type="button"
            onClick={() => setOpen(true)}
            className="mt-8 w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 active:scale-[0.98] sm:w-auto sm:px-10"
          >
            Iniciar diagnóstico
          </ShinyButton>
          <p className="mt-4 text-xs text-muted-foreground">Te tomará menos de 3 minutos.</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl border-none bg-transparent p-0 shadow-none">
            <DialogTitle className="sr-only">Diagnóstico Inteligente PixelTEC</DialogTitle>
            <DialogDescription className="sr-only">
              Responde unas preguntas y recibe una recomendación personalizada para tu empresa.
            </DialogDescription>
            <DiagnosticWizard variant="modal" onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
