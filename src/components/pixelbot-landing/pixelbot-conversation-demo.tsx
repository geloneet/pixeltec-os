'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Bot, Check, UserRound } from 'lucide-react';
import { PixelbotChatWallpaper } from './pixelbot-chat-wallpaper';

/**
 * Demo sintética del hero: una conversación se convierte en datos, estado y
 * handoff. No envía nada — es una composición estática animada con datos de
 * demostración. Con reduced motion se renderiza sin animación.
 */

type Bubble = {
  from: 'cliente' | 'bot';
  text: string;
};

const BUBBLES: Bubble[] = [
  { from: 'cliente', text: 'Hola, ¿dan mantenimiento a flotillas?' },
  { from: 'bot', text: '¡Hola! Sí, trabajamos con flotillas. ¿Cuántas unidades tienes?' },
  { from: 'cliente', text: 'Son 12 camionetas.' },
  { from: 'bot', text: 'Perfecto. ¿En qué ciudad operan? Con eso te preparo una propuesta con un asesor.' },
  { from: 'cliente', text: 'En Guadalajara.' },
];

const CAPTURED = [
  { label: 'Interés', value: 'Mantenimiento de flotilla' },
  { label: 'Unidades', value: '12' },
  { label: 'Ciudad', value: 'Guadalajara' },
];

export function PixelbotConversationDemo() {
  const reduceMotion = useReducedMotion();

  const appear = (index: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount: 0.4 },
          transition: { delay: 0.25 + index * 0.3, duration: 0.4, ease: 'easeOut' as const },
        };

  return (
    <div aria-label="Demostración de una conversación atendida por PixelBot, con datos de ejemplo" className="relative w-full max-w-xl mx-auto lg:mx-0">
      {/* Hilo de conversación */}
      <div className="rounded-2xl border border-border bg-card/90 dark:bg-[#0A0A0A]/90 backdrop-blur-sm p-4 sm:p-5 shadow-sm dark:shadow-[0_0_50px_rgba(33,150,243,0.07)]">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <p className="text-sm font-semibold text-foreground">WhatsApp del negocio</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-400">
            <Bot className="h-3.5 w-3.5" aria-hidden="true" />
            Bot respondiendo
          </span>
        </div>

        <div className="relative overflow-hidden rounded-xl bg-muted/40 dark:bg-black/40">
          <PixelbotChatWallpaper className="absolute inset-0 h-full w-full text-black/[0.07] dark:text-white/[0.055]" />
          <ul className="relative space-y-3 p-3 sm:p-3.5" aria-hidden="false">
            {BUBBLES.map((bubble, i) => (
              <motion.li
                key={i}
                {...appear(i)}
                className={bubble.from === 'bot' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  className={
                    bubble.from === 'bot'
                      ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-primary/15 dark:bg-cyan-500/15 border border-primary/20 dark:border-cyan-500/20 px-4 py-2.5'
                      : 'max-w-[85%] rounded-2xl rounded-bl-sm bg-muted/70 dark:bg-white/5 border border-border px-4 py-2.5'
                  }
                >
                  {bubble.from === 'bot' && (
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-primary dark:text-cyan-400 mb-0.5">
                      PixelBot
                    </p>
                  )}
                  <p className="text-sm text-foreground/90 leading-relaxed">{bubble.text}</p>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>

      {/* Datos capturados */}
      <motion.div
        {...appear(BUBBLES.length)}
        className="relative -mt-3 ml-4 sm:ml-8 rounded-xl border border-border bg-card dark:bg-[#0D0D0D] p-4 shadow-sm"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Datos capturados en la conversación
        </p>
        <dl className="flex flex-wrap gap-2">
          {CAPTURED.map((item) => (
            <div
              key={item.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 dark:bg-white/5 px-3 py-1"
            >
              <Check className="h-3 w-3 text-primary dark:text-cyan-400" aria-hidden="true" />
              <dt className="text-xs text-muted-foreground">{item.label}:</dt>
              <dd className="text-xs font-medium text-foreground">{item.value}</dd>
            </div>
          ))}
        </dl>
      </motion.div>

      {/* Handoff */}
      <motion.div
        {...appear(BUBBLES.length + 1)}
        className="relative -mt-2 mr-4 sm:mr-8 ml-10 sm:ml-20 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/30">
            <UserRound className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Laura (Ventas) tomó la conversación</p>
            <p className="text-xs text-muted-foreground">Recibió el resumen y los datos — el bot guarda silencio.</p>
          </div>
        </div>
      </motion.div>

      <p className="mt-3 text-center lg:text-left text-[11px] text-muted-foreground/70">
        Conversación de demostración con datos ficticios.
      </p>
    </div>
  );
}
