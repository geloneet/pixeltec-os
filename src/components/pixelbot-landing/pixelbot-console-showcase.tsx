'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Bot, Check, PauseCircle, Play, UserRound } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CONSOLE_SHOWCASE } from './pixelbot-content';

/**
 * Showcase de la consola como recreación mínima en código (sin capturas):
 * cada tab muestra solo los elementos esenciales, al estilo de la demo del
 * hero. Todo es ilustrativo con datos ficticios — nada envía ni guarda.
 */

function Panel({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      {...(reduceMotion
        ? {}
        : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, ease: 'easeOut' } })}
      className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card/90 dark:bg-[#0A0A0A]/90 p-4 sm:p-5 shadow-sm dark:shadow-[0_0_50px_rgba(33,150,243,0.07)]"
    >
      {children}
    </motion.div>
  );
}

const chip = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium';

function BandejaMock() {
  return (
    <Panel>
      <ul className="space-y-2.5">
        <li className="rounded-xl border border-border bg-muted/40 dark:bg-white/5 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-foreground/90 truncate">¿Me pueden cotizar el sitio web?</p>
            <span className={`${chip} border border-primary/30 bg-primary/10 text-primary dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-400`}>
              <Bot className="h-3 w-3" aria-hidden="true" /> Bot
            </span>
          </div>
        </li>
        <li className="rounded-xl border border-border bg-muted/40 dark:bg-white/5 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-foreground/90 truncate">Perfecto, quedo al pendiente. ¡Gracias!</p>
            <span className={`${chip} border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400`}>
              <UserRound className="h-3 w-3" aria-hidden="true" /> Humano
            </span>
          </div>
        </li>
      </ul>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-2.5">
        <p className="text-xs text-muted-foreground">
          El bot sugiere: <span className="font-semibold text-foreground">Prospecto</span>
        </p>
        <span className={`${chip} border border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400`}>
          Tomar control
        </span>
      </div>
    </Panel>
  );
}

function BotMock() {
  return (
    <Panel>
      <dl className="space-y-2.5 text-sm">
        <div className="flex items-center justify-between rounded-xl border border-border px-4 py-2.5">
          <dt className="text-muted-foreground">Nombre público</dt>
          <dd className="font-medium text-foreground">Pixel</dd>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border px-4 py-2.5">
          <dt className="text-muted-foreground">Tono</dt>
          <dd className="font-medium text-foreground">Cercano · Casual profesional</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className={`${chip} border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400`}>
          <Check className="h-3 w-3" aria-hidden="true" /> precios y servicios
        </span>
        <span className={`${chip} border border-border bg-muted/50 text-muted-foreground line-through`}>
          datos de otros clientes
        </span>
        <span className={`${chip} border border-border bg-muted/50 text-muted-foreground`}>
          <PauseCircle className="h-3 w-3" aria-hidden="true" /> fuera de horario: mensaje propio
        </span>
      </div>
    </Panel>
  );
}

function EntrenamientoMock() {
  return (
    <Panel>
      <ul className="space-y-2.5">
        <li className="rounded-xl border border-border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">¿Cuánto cuesta una página web?</p>
            <span aria-hidden="true" className="relative h-4 w-8 rounded-full bg-cyan-500/80">
              <span className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full bg-white" />
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground truncate">Cada proyecto se cotiza según su alcance…</p>
        </li>
        <li className="rounded-xl border border-border px-4 py-3 opacity-60">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">¿Hacen apps móviles?</p>
            <span aria-hidden="true" className="relative h-4 w-8 rounded-full bg-muted">
              <span className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-muted-foreground/60" />
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Inactivo — no se usa al responder.</p>
        </li>
      </ul>
    </Panel>
  );
}

function PruebasMock() {
  return (
    <Panel>
      <div className="rounded-xl border border-border bg-muted/40 dark:bg-white/5 px-4 py-2.5 text-sm text-muted-foreground">
        Escribe como si fueras un cliente…
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-3">
        <span className={`${chip} border border-primary/30 bg-primary/10 text-primary dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-400`}>
          <Play className="h-3 w-3" aria-hidden="true" /> Probar mensaje
        </span>
        <p className="text-[11px] text-muted-foreground">No envía nada a WhatsApp</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 rounded-xl border border-border px-4 py-2.5">
        <span className={`${chip} bg-emerald-500/10 text-emerald-600 dark:text-emerald-400`}>Escalaría: no</span>
        <span className={`${chip} bg-muted/60 text-muted-foreground`}>Versión activa: publicada</span>
        <span className={`${chip} bg-muted/60 text-muted-foreground`}>Volver a versión anterior</span>
      </div>
    </Panel>
  );
}

const MOCKS: Record<string, () => React.JSX.Element> = {
  bandeja: BandejaMock,
  bot: BotMock,
  entrenamiento: EntrenamientoMock,
  pruebas: PruebasMock,
};

export function PixelbotConsoleShowcase() {
  return (
    <section className="py-14 sm:py-20">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
          {CONSOLE_SHOWCASE.title}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-base sm:text-lg text-muted-foreground leading-relaxed">
          {CONSOLE_SHOWCASE.intro}
        </p>

        <Tabs defaultValue={CONSOLE_SHOWCASE.tabs[0].id} className="mt-10">
          <div className="flex justify-center">
            <TabsList className="h-auto flex-wrap justify-center gap-1 bg-muted/60 dark:bg-white/5 border border-border">
              {CONSOLE_SHOWCASE.tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="px-4 py-2 text-sm data-[state=active]:text-primary dark:data-[state=active]:text-cyan-400"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {CONSOLE_SHOWCASE.tabs.map((tab) => {
            const Mock = MOCKS[tab.id];
            return (
              <TabsContent key={tab.id} value={tab.id} className="mt-8">
                <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
                  <div className="text-center lg:text-left">
                    <h3 className="text-lg sm:text-xl font-semibold text-foreground">{tab.heading}</h3>
                    <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">{tab.detail}</p>
                  </div>
                  <Mock />
                </div>
              </TabsContent>
            );
          })}
        </Tabs>

        <p className="mt-6 text-center text-xs text-muted-foreground/70">{CONSOLE_SHOWCASE.note}</p>
      </div>
    </section>
  );
}
