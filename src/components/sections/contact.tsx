'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { submitContactForm } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { CircleAlert, CircleCheck, Loader2 } from 'lucide-react';
import { ShinyButton } from '../ui/shiny-button';
import { cn } from '@/lib/utils';

const initialState = {
  message: '',
  isSuccess: false,
  errors: undefined,
};

const INTEREST_OPTIONS = [
  'Automatización',
  'Software a medida',
  'Inteligencia artificial',
  'Datos e integraciones',
  'Aún no estoy seguro',
] as const;

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="mt-1 flex items-start gap-1.5 text-sm text-destructive">
      <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export default function ContactSection() {
  const [state, formAction, isPending] = useActionState(submitContactForm, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [consent, setConsent] = useState(false);
  const [interest, setInterest] = useState<string | null>(null);

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
      setInterest(null);
      setConsent(false);
    }
  }, [state, toast]);

  // Opción A (sin cambio de contrato): el interés viaja dentro de `message`
  // con prefijo estable, inyectado SOLO en el submit — el textarea que ve el
  // usuario nunca se modifica.
  const handleAction = (formData: FormData) => {
    if (interest) {
      const message = (formData.get('message') ?? '').toString();
      formData.set('message', `Interés: ${interest}\n\n${message}`);
    }
    formAction(formData);
  };

  return (
    <section id="contact" className="bg-background py-16 dark:bg-[#0A0A0B] md:py-24">
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        {/* ── 1. Contacto compacto — prospectos decididos ────────────────── */}
        <div className="grid gap-10 md:grid-cols-5 md:gap-14">
          <div className="md:col-span-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Cuéntanos qué está frenando tu operación
            </h2>
            <p className="mt-4 max-w-md text-base font-light leading-relaxed text-muted-foreground">
              Revisamos tu caso y te proponemos un siguiente paso claro, sin soluciones genéricas.
            </p>
          </div>

          <form ref={formRef} action={handleAction} className="space-y-5 md:col-span-3">
            {/* Honeypot — hidden from humans (incl. screen readers), tempting for naive bots. */}
            <div
              aria-hidden="true"
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}
            >
              <label htmlFor="website-hp">No completar este campo.</label>
              <input
                id="website-hp"
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
              />
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-foreground">¿Qué necesitas resolver?</legend>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((option) => (
                  <label key={option} className="cursor-pointer">
                    <input
                      type="radio"
                      name="interest"
                      value={option}
                      checked={interest === option}
                      onChange={() => setInterest(option)}
                      onClick={() => {
                        // Selección opcional: volver a clickear la misma opción la limpia.
                        if (interest === option) setInterest(null);
                      }}
                      className="peer sr-only"
                    />
                    <span
                      className={cn(
                        'inline-flex min-h-[2.25rem] items-center rounded-full border px-3.5 py-1.5 text-sm transition-colors',
                        'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cyan-400',
                        interest === option
                          ? 'border-cyan-500/60 bg-cyan-500/10 font-medium text-foreground dark:text-cyan-300'
                          : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                      )}
                    >
                      {option}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Tu nombre"
                  required
                  aria-invalid={Boolean(state.errors?.name)}
                  aria-describedby={state.errors?.name ? 'name-error' : undefined}
                  className="border-border bg-transparent focus:border-primary"
                />
                {state.errors?.name && <FieldError id="name-error">{state.errors.name[0]}</FieldError>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="tu@email.com"
                  required
                  aria-invalid={Boolean(state.errors?.email)}
                  aria-describedby={state.errors?.email ? 'email-error' : undefined}
                  className="border-border bg-transparent focus:border-primary"
                />
                {state.errors?.email && <FieldError id="email-error">{state.errors.email[0]}</FieldError>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">¿Qué quieres resolver?</Label>
              <Textarea
                id="message"
                name="message"
                placeholder="Cuéntanos qué está frenando tu operación..."
                required
                minLength={10}
                rows={4}
                aria-invalid={Boolean(state.errors?.message)}
                aria-describedby={state.errors?.message ? 'message-error' : undefined}
                className="border-border bg-transparent focus:border-primary"
              />
              {state.errors?.message && (
                <FieldError id="message-error">{state.errors.message[0]}</FieldError>
              )}
            </div>

            <div className="flex items-start gap-3 pt-1">
              <input type="hidden" name="consent" value={consent ? 'on' : ''} />
              <Checkbox
                id="contact-consent"
                checked={consent}
                onCheckedChange={(checked) => setConsent(Boolean(checked))}
                className="mt-0.5 border-foreground/40 data-[state=checked]:border-cyan-500 data-[state=checked]:bg-cyan-500"
              />
              <Label
                htmlFor="contact-consent"
                className="cursor-pointer text-sm leading-relaxed text-foreground/80"
              >
                He leído y acepto el{' '}
                <Link
                  href="/aviso-de-privacidad"
                  target="_blank"
                  className="text-primary hover:underline dark:text-cyan-400"
                >
                  Aviso de Privacidad
                </Link>
              </Label>
            </div>
            {state.errors?.consent && (
              <FieldError id="consent-error">{state.errors.consent[0]}</FieldError>
            )}

            <div className="pt-1">
              <ShinyButton
                type="submit"
                disabled={!consent || isPending}
                aria-describedby={!consent ? 'submit-hint' : undefined}
                aria-busy={isPending}
                className="w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Enviando…
                  </span>
                ) : (
                  'Solicitar revisión'
                )}
              </ShinyButton>
              {!consent && !isPending && (
                <p id="submit-hint" className="mt-2 text-center text-xs text-muted-foreground">
                  Acepta el Aviso de Privacidad para poder enviar.
                </p>
              )}
            </div>

            <div aria-live="polite">
              {state.isSuccess && (
                <p className="mt-2 flex items-center justify-center gap-2 text-sm text-green-700 dark:text-green-400">
                  <CircleCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                  ¡Gracias! Tu mensaje ha sido enviado con éxito.
                </p>
              )}
            </div>
          </form>
        </div>

      </div>
    </section>
  );
}
