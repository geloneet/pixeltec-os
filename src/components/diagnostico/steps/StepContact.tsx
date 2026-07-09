'use client';

import Link from 'next/link';
import { User, Mail, Phone, Building2, Check, MessageCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { ShinyButton } from '@/components/ui/shiny-button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { buildWhatsappLink } from '@/lib/diagnostic/logic';
import type { WizardAnswers } from '../types';

const inputCls =
  'h-12 w-full rounded-lg border border-white/10 bg-black/50 pl-11 text-sm text-white placeholder:text-zinc-500 transition-colors duration-200 hover:bg-black/60 focus-visible:outline-none focus-visible:border-cyan-500/60 focus-visible:bg-black/60';

interface Props {
  answers: WizardAnswers;
  update: (updates: Partial<WizardAnswers>) => void;
  onSubmit: () => void;
  submitting: boolean;
  errorMessage: string | null;
}

export function StepContact({ answers, update, onSubmit, submitting, errorMessage }: Props) {
  const canSubmit = answers.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(answers.email) && answers.consent;

  return (
    <div>
      <h2 className="text-xl md:text-2xl font-bold text-white mb-1">Un último paso</h2>
      <p className="text-zinc-500 text-sm mb-6">Para preparar tu diagnóstico personalizado.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit && !submitting) onSubmit();
        }}
        className="space-y-4"
      >
        {/* Honeypot — oculto para humanos. */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
          <label htmlFor="diagnostic-hp">No completar este campo.</label>
          <input
            id="diagnostic-hp"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={answers.website}
            onChange={(e) => update({ website: e.target.value })}
          />
        </div>

        <div className="group relative">
          <Label htmlFor="diag-name" className="sr-only">Nombre</Label>
          <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 transition-colors group-focus-within:text-cyan-400" />
          <input
            id="diag-name"
            value={answers.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Tu nombre"
            required
            className={inputCls}
          />
        </div>
        <div className="group relative">
          <Label htmlFor="diag-email" className="sr-only">Email</Label>
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 transition-colors group-focus-within:text-cyan-400" />
          <input
            id="diag-email"
            type="email"
            value={answers.email}
            onChange={(e) => update({ email: e.target.value })}
            placeholder="tu@empresa.com"
            required
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="group relative">
            <Label htmlFor="diag-phone" className="sr-only">WhatsApp</Label>
            <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 transition-colors group-focus-within:text-cyan-400" />
            <input
              id="diag-phone"
              value={answers.phone}
              onChange={(e) => update({ phone: e.target.value })}
              placeholder="WhatsApp"
              className={inputCls}
            />
          </div>
          <div className="group relative">
            <Label htmlFor="diag-empresa" className="sr-only">Empresa</Label>
            <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 transition-colors group-focus-within:text-cyan-400" />
            <input
              id="diag-empresa"
              value={answers.empresa}
              onChange={(e) => update({ empresa: e.target.value })}
              placeholder="Empresa"
              className={inputCls}
            />
          </div>
        </div>

        <label htmlFor="diag-consent" className="flex items-start gap-2.5 pt-2 cursor-pointer">
          <input
            id="diag-consent"
            type="checkbox"
            checked={answers.consent}
            onChange={(e) => update({ consent: e.target.checked })}
            className="sr-only peer"
          />
          <span
            className={cn(
              'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
              answers.consent ? 'border-cyan-400 bg-cyan-500/80' : 'border-zinc-600'
            )}
          >
            {answers.consent && <Check className="h-3 w-3 text-white" />}
          </span>
          <span className="text-xs font-normal text-zinc-400 leading-relaxed">
            Acepto el{' '}
            <Link href="/aviso-de-privacidad" target="_blank" className="text-cyan-400 hover:underline">
              Aviso de Privacidad
            </Link>{' '}
            de PixelTEC.
          </span>
        </label>

        {errorMessage && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
            <p className="text-sm text-destructive">{errorMessage}</p>
            <p className="text-xs text-zinc-400">
              Puedes intentar de nuevo o escribirnos directo:
            </p>
            <a
              href={buildWhatsappLink(
                `Hola, quiero mi Diagnóstico Estratégico. Tuve un problema al enviar el formulario.\n` +
                  `Nombre: ${answers.name}\nEmail: ${answers.email}`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Contactar por WhatsApp
            </a>
          </div>
        )}

        <ShinyButton type="submit" disabled={!canSubmit || submitting} className="w-full mt-2">
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <Spinner size="sm" /> Analizando…
            </span>
          ) : (
            'Ver mi diagnóstico'
          )}
        </ShinyButton>
      </form>
    </div>
  );
}
