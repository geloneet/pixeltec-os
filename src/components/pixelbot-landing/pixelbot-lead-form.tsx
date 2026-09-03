'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, MessageCircle, Send } from 'lucide-react';

import { submitContactForm } from '@/app/actions';
import { SessionIdField } from '@/components/analytics/session-id-field';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShinyButton } from '@/components/ui/shiny-button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { TEAM_PHONE } from '@/lib/diagnostic/logic';
import { FINAL_CTA, PACKAGES, buildPixelbotMessage } from './pixelbot-content';

const initialState = {
  message: '',
  isSuccess: false,
  errors: undefined,
};

const WHATSAPP_HREF = `https://api.whatsapp.com/send?phone=${TEAM_PHONE}&text=${encodeURIComponent(
  FINAL_CTA.whatsappMessage
)}`;

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ShinyButton type="submit" className="w-full" disabled={pending || !!disabled}>
      {pending ? (
        <LoaderCircle className="h-6 w-6 animate-spin" aria-hidden="true" />
      ) : (
        <>
          {FINAL_CTA.submitLabel} <Send className="ml-2 h-5 w-5" aria-hidden="true" />
        </>
      )}
    </ShinyButton>
  );
}

/**
 * Captura de leads de PixelBot sobre el pipeline existente: reutiliza
 * submitContactForm sin cambios de contrato. El interés y el volumen viajan
 * dentro de `message` con prefijo estable (patrón Opción A de
 * sections/contact.tsx). Conserva honeypot, consentimiento y rate limit.
 */
export function PixelbotLeadForm() {
  const [state, formAction] = useActionState(submitContactForm, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [consent, setConsent] = useState(false);
  const [volume, setVolume] = useState('');
  const [plan, setPlan] = useState('');
  const [botName, setBotName] = useState('');

  useEffect(() => {
    if (state.message && !state.isSuccess) {
      toast({
        title: 'Error en el formulario',
        description: state.message,
        variant: 'destructive',
      });
    }
    if (state.isSuccess) {
      formRef.current?.reset();
      setVolume('');
      setPlan('');
      setBotName('');
      setConsent(false);
    }
  }, [state, toast]);

  const handleAction = (formData: FormData) => {
    const rawMessage = (formData.get('message') ?? '').toString();
    formData.set('message', buildPixelbotMessage(rawMessage, volume, plan, botName));
    formAction(formData);
  };

  return (
    <section id="diagnostico" className="py-14 sm:py-20 scroll-mt-28">
      <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-border bg-gradient-to-tr from-primary/5 via-card to-card dark:from-cyan-950/40 dark:via-[#0A0A0A] dark:to-[#0A0A0A] p-6 sm:p-10 lg:p-14 shadow-sm dark:shadow-[0_0_50px_rgba(33,150,243,0.06)]">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
            <div className="text-center lg:text-left">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground [text-wrap:balance]">
                {FINAL_CTA.title}
              </h2>
              <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">{FINAL_CTA.body}</p>
              <div className="mt-8">
                <p className="text-sm text-muted-foreground">{FINAL_CTA.whatsappFallbackLabel}</p>
                <a
                  href={WHATSAPP_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-primary dark:text-cyan-400 hover:underline"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  Escríbenos por WhatsApp
                </a>
              </div>
            </div>

            <form ref={formRef} action={handleAction} className="space-y-5" aria-describedby="pixelbot-form-status">
              {/* WO-2026-00214: une el lead con su rastro de contenido. */}
              <SessionIdField />
              {/* Honeypot — oculto para humanos (y lectores de pantalla), tentador para bots simples. */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
                <label htmlFor="pixelbot-website-hp">No completar este campo.</label>
                <input
                  id="pixelbot-website-hp"
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                />
              </div>

              <div>
                <Label htmlFor="pixelbot-name" className="text-foreground/80">Nombre completo</Label>
                <Input id="pixelbot-name" name="name" required autoComplete="name" className="mt-2 bg-muted/40 dark:bg-black/50 dark:border-white/10" />
                {state.errors?.name && <p className="mt-1 text-sm text-destructive">{state.errors.name[0]}</p>}
              </div>
              <div>
                <Label htmlFor="pixelbot-email" className="text-foreground/80">Email empresarial</Label>
                <Input id="pixelbot-email" name="email" type="email" required autoComplete="email" className="mt-2 bg-muted/40 dark:bg-black/50 dark:border-white/10" />
                {state.errors?.email && <p className="mt-1 text-sm text-destructive">{state.errors.email[0]}</p>}
              </div>
              <div>
                <Label htmlFor="pixelbot-empresa" className="text-foreground/80">Empresa (opcional)</Label>
                <Input id="pixelbot-empresa" name="empresa" autoComplete="organization" className="mt-2 bg-muted/40 dark:bg-black/50 dark:border-white/10" />
              </div>
              <div>
                <Label htmlFor="pixelbot-volume" className="text-foreground/80">Volumen aproximado de mensajes (opcional)</Label>
                <select
                  id="pixelbot-volume"
                  value={volume}
                  onChange={(event) => setVolume(event.target.value)}
                  className="mt-2 flex h-10 w-full rounded-md border border-input bg-muted/40 dark:bg-black/50 dark:border-white/10 px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Selecciona una opción</option>
                  {FINAL_CTA.volumeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="pixelbot-plan" className="text-foreground/80">Plan de interés (opcional)</Label>
                <select
                  id="pixelbot-plan"
                  value={plan}
                  onChange={(event) => setPlan(event.target.value)}
                  className="mt-2 flex h-10 w-full rounded-md border border-input bg-muted/40 dark:bg-black/50 dark:border-white/10 px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Selecciona una opción</option>
                  {PACKAGES.map((pkg) => (
                    <option key={pkg.id} value={pkg.name}>
                      {pkg.name}
                    </option>
                  ))}
                  <option value="No estoy seguro">No estoy seguro</option>
                </select>
              </div>
              <div>
                <Label htmlFor="pixelbot-bot-name" className="text-foreground/80">¿Cómo quieres llamar a tu bot? (opcional)</Label>
                <Input
                  id="pixelbot-bot-name"
                  value={botName}
                  onChange={(event) => setBotName(event.target.value)}
                  placeholder="Ej. Dentista Bot"
                  className="mt-2 bg-muted/40 dark:bg-black/50 dark:border-white/10"
                />
              </div>
              <div>
                <Label htmlFor="pixelbot-message" className="text-foreground/80">¿Qué quieres automatizar?</Label>
                <Textarea
                  id="pixelbot-message"
                  name="message"
                  required
                  rows={4}
                  placeholder="Cuéntanos cómo usa WhatsApp tu negocio hoy y qué te gustaría resolver."
                  className="mt-2 bg-muted/40 dark:bg-black/50 dark:border-white/10"
                />
                {state.errors?.message && <p className="mt-1 text-sm text-destructive">{state.errors.message[0]}</p>}
              </div>

              <div className="flex items-start gap-3">
                <input type="hidden" name="consent" value={consent ? 'on' : ''} />
                <Checkbox
                  id="pixelbot-consent"
                  checked={consent}
                  onCheckedChange={(checked) => setConsent(Boolean(checked))}
                  className="mt-0.5 border-border data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                />
                <Label htmlFor="pixelbot-consent" className="cursor-pointer text-sm leading-relaxed text-muted-foreground">
                  He leído y acepto el{' '}
                  <Link
                    href="/aviso-de-privacidad"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary dark:text-cyan-400 hover:underline"
                  >
                    Aviso de Privacidad
                  </Link>
                </Label>
              </div>
              {state.errors?.consent && <p className="-mt-2 text-sm text-destructive">{state.errors.consent[0]}</p>}

              <div aria-live="polite" id="pixelbot-form-status">
                {state.isSuccess && (
                  <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
                    {state.message}
                  </p>
                )}
              </div>

              <div className="pt-2">
                <SubmitButton disabled={!consent} />
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
