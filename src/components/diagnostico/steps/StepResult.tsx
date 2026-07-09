'use client';

import { useState } from 'react';
import { CheckCircle, Circle, MessageCircle, Phone, Mail, Calendar, Check, AlertTriangle } from 'lucide-react';
import type { DiagnosticResult } from '@/lib/diagnostic/logic';
import { buildDiagnosticSummary, buildWhatsappLink, buildMailtoLink, TEL_HREF, SCHEDULING_URL } from '@/lib/diagnostic/logic';
import { requestDiagnosticContactAction } from '@/app/actions';
import { ShinyButton } from '@/components/ui/shiny-button';
import { Spinner } from '@/components/ui/spinner';
import type { WizardAnswers } from '../types';

export function StepResult({
  result,
  answers,
  leadId,
}: {
  result: DiagnosticResult;
  answers: WizardAnswers;
  leadId: string | null;
}) {
  const [contactState, setContactState] = useState<'idle' | 'submitting' | 'sent' | 'error'>('idle');

  async function handleWantsContact() {
    if (!leadId || contactState === 'submitting') return;
    setContactState('submitting');
    try {
      const res = await requestDiagnosticContactAction(leadId);
      // HOTFIX (code review 2026-07-09): antes un `finally` sin `catch`
      // siempre mostraba "enviado" incluso si el server action fallaba o
      // lanzaba a nivel de transporte (dejando además una promesa rechazada
      // sin capturar). Ahora reflejamos el resultado real — si falló, el
      // visitante ve un aviso claro y ya tiene los botones de WhatsApp/
      // llamada/email justo debajo como respaldo.
      setContactState(res.ok ? 'sent' : 'error');
    } catch (err) {
      console.error('[diagnostic] handleWantsContact failed:', err);
      setContactState('error');
    }
  }

  const summary = buildDiagnosticSummary(result, {
    companyType: answers.companyType,
    problems: answers.problems,
    companySize: answers.companySize,
    priority: answers.priority,
    name: answers.name,
    email: answers.email,
    phone: answers.phone || undefined,
    empresa: answers.empresa || undefined,
  });
  const whatsappHref = buildWhatsappLink(summary);
  const mailtoHref = buildMailtoLink(summary);

  return (
    <div>
      <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Resultado del diagnóstico</p>
      <h2 className="text-xl md:text-2xl font-bold text-white mb-6">Nivel de madurez digital</h2>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-400">Madurez</span>
          <span className="text-lg font-bold text-cyan-400">{result.score}%</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-700"
            style={{ width: `${result.score}%` }}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6 mb-8">
        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Fortalezas</p>
          <ul className="space-y-2">
            {result.strengths.map((s) => (
              <li key={s} className="flex items-start gap-2 text-sm text-zinc-300">
                <CheckCircle className="h-4 w-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Áreas de oportunidad</p>
          <ul className="space-y-2">
            {result.opportunities.map((o) => (
              <li key={o} className="flex items-start gap-2 text-sm text-zinc-300">
                <Circle className="h-2 w-2 text-zinc-600 flex-shrink-0 mt-1.5 fill-zinc-600" />
                {o}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl bg-cyan-950/20 border border-cyan-500/20 p-5 mb-8">
        <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-3">Recomendación PixelTEC</p>
        <p className="text-sm text-zinc-400 mb-3">Con base en tus respuestas recomendamos:</p>
        <ul className="space-y-1.5 mb-4">
          {result.recommendedServices.map((s) => (
            <li key={s} className="flex items-center gap-2 text-sm font-medium text-zinc-200">
              <CheckCircle className="h-4 w-4 text-cyan-400 flex-shrink-0" />
              {s}
            </li>
          ))}
        </ul>
        <p className="text-xs text-zinc-500">
          Tiempo estimado de implementación: <span className="text-zinc-300 font-semibold">{result.timeline}</span>
        </p>
      </div>

      <div className="mb-8">
        {contactState === 'sent' ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-sm font-semibold py-3.5">
            <Check className="h-4 w-4" /> ¡Listo! Un asesor de PixelTEC te va a contactar.
          </div>
        ) : contactState === 'error' ? (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm font-semibold py-3.5">
              <AlertTriangle className="h-4 w-4" /> No pudimos confirmar tu solicitud automáticamente.
            </div>
            <p className="text-xs text-zinc-500 text-center">
              Usa WhatsApp, llamada o email abajo — es directo con el equipo.
            </p>
          </div>
        ) : (
          <ShinyButton type="button" onClick={handleWantsContact} disabled={!leadId} className="w-full py-3.5">
            {contactState === 'submitting' ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size="sm" /> Enviando…
              </span>
            ) : (
              'Quiero que me contacten'
            )}
          </ShinyButton>
        )}
      </div>

      <div>
        <h3 className="text-lg font-bold text-white mb-1">Agendar Diagnóstico Estratégico</h3>
        <p className="text-sm text-zinc-500 mb-4">O elige cómo prefieres continuar la conversación.</p>
        <div className="grid sm:grid-cols-3 gap-2.5">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm font-semibold py-3 transition-colors hover:bg-emerald-500/20"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
          <a
            href={TEL_HREF}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-zinc-200 text-sm font-semibold py-3 transition-colors hover:bg-white/10"
          >
            <Phone className="h-4 w-4" /> Llamar a PixelTEC
          </a>
          <a
            href={mailtoHref}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-zinc-200 text-sm font-semibold py-3 transition-colors hover:bg-white/10"
          >
            <Mail className="h-4 w-4" /> Email
          </a>
        </div>
        {SCHEDULING_URL && (
          <a
            href={SCHEDULING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2.5 flex items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-sm font-semibold py-3 transition-colors hover:bg-cyan-500/20"
          >
            <Calendar className="h-4 w-4" /> Agendar en calendario
          </a>
        )}
      </div>
    </div>
  );
}
