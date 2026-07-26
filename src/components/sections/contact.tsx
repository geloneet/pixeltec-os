'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { submitContactForm } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, CircleAlert, CircleCheck, Loader2 } from 'lucide-react';
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

const TOTAL_STEPS = 3;

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
  const nameRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const [step, setStep] = useState(1);
  const [consent, setConsent] = useState(false);
  const [interest, setInterest] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [stepError, setStepError] = useState('');

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
      setName('');
      setEmail('');
      setStep(1);
    }
  }, [state, toast]);

  // Al revelar un paso, el foco viaja a su primer campo.
  useEffect(() => {
    if (step === 2) nameRef.current?.focus();
    if (step === 3) messageRef.current?.focus();
  }, [step]);

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

  const chooseInterest = (option: string) => {
    setInterest(option);
    setStepError('');
    setStep(2);
  };

  const goToStepThree = () => {
    if (name.trim().length < 2) {
      setStepError('Escribe tu nombre para continuar.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStepError('Escribe un correo válido para continuar.');
      return;
    }
    setStepError('');
    setStep(3);
  };

  return (
    <section id="contact" className="bg-transparent py-16 md:py-24">
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <div className="overflow-hidden rounded-3xl border border-border bg-card/40 p-6 backdrop-blur-sm md:p-10">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
            {/* ── Columna de formulario ─────────────────────────────────── */}
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-primary dark:text-cyan-400">
                  Paso {step} de {TOTAL_STEPS}
                </span>
                <div className="flex gap-1.5" aria-hidden="true">
                  {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'h-1 w-6 rounded-full transition-colors',
                        i < step ? 'bg-cyan-400' : 'bg-border'
                      )}
                    />
                  ))}
                </div>
              </div>

              <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">
                Cuéntanos qué está{' '}
                <span className="bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
                  frenando
                </span>{' '}
                tu operación
              </h2>
              <p className="mt-4 max-w-md text-base font-light leading-relaxed text-muted-foreground">
                Revisamos tu caso y te proponemos un siguiente paso claro, sin soluciones genéricas.
              </p>

              <form ref={formRef} action={handleAction} className="mt-8 space-y-5">
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

                {/* ── Paso 1: interés ─────────────────────────────────── */}
                {step === 1 ? (
                  <fieldset>
                    <legend className="text-sm font-medium text-foreground">
                      ¿Qué necesitas resolver?
                    </legend>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {INTEREST_OPTIONS.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => chooseInterest(option)}
                          className="inline-flex min-h-[2.5rem] items-center rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-cyan-500/50 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ) : (
                  // Elegida: se queda solo esa opción, con vuelta atrás.
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex min-h-[2.5rem] items-center rounded-full border border-cyan-500/60 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-foreground dark:text-cyan-300">
                      {interest}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setStep(1);
                        setInterest(null);
                        setStepError('');
                      }}
                      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      Cambiar
                    </button>
                  </div>
                )}

                {/* ── Paso 2: nombre y correo ─────────────────────────── */}
                {step >= 2 && (
                  <>
                    <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-muted/30">
                      <div className="px-4 py-3">
                        <Label htmlFor="name" className="text-xs font-medium text-muted-foreground">
                          Nombre
                        </Label>
                        <Input
                          ref={nameRef}
                          id="name"
                          name="name"
                          placeholder="Tu nombre"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          aria-invalid={Boolean(state.errors?.name)}
                          aria-describedby={state.errors?.name ? 'name-error' : undefined}
                          className="h-8 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
                        />
                      </div>
                      <div className="px-4 py-3">
                        <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                          Email
                        </Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="tu@email.com"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          aria-invalid={Boolean(state.errors?.email)}
                          aria-describedby={state.errors?.email ? 'email-error' : undefined}
                          className="h-8 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
                        />
                      </div>
                    </div>
                    {state.errors?.name && <FieldError id="name-error">{state.errors.name[0]}</FieldError>}
                    {state.errors?.email && <FieldError id="email-error">{state.errors.email[0]}</FieldError>}
                  </>
                )}

                {/* ── Paso 3: mensaje, consentimiento y envío ─────────── */}
                {step >= 3 && (
                  <>
                    <div className="overflow-hidden rounded-2xl border border-border bg-muted/30 px-4 py-3">
                      <Label htmlFor="message" className="text-xs font-medium text-muted-foreground">
                        ¿Qué quieres resolver?
                      </Label>
                      <Textarea
                        ref={messageRef}
                        id="message"
                        name="message"
                        placeholder="Cuéntanos qué está frenando tu operación..."
                        required
                        minLength={10}
                        rows={4}
                        aria-invalid={Boolean(state.errors?.message)}
                        aria-describedby={state.errors?.message ? 'message-error' : undefined}
                        className="resize-none border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
                      />
                    </div>
                    {state.errors?.message && (
                      <FieldError id="message-error">{state.errors.message[0]}</FieldError>
                    )}

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
                  </>
                )}

                {/* Aviso de validación entre pasos */}
                <div aria-live="polite">
                  {stepError && <FieldError id="step-error">{stepError}</FieldError>}
                </div>

                {/* ── Acción según el paso ────────────────────────────── */}
                {step === 2 && (
                  <div className="pt-2">
                    <ShinyButton type="button" onClick={goToStepThree} className="active:scale-[0.98]">
                      Continuar
                    </ShinyButton>
                  </div>
                )}

                {step === 3 && (
                  <div className="flex flex-wrap items-center gap-4 pt-2">
                    <ShinyButton
                      type="submit"
                      disabled={!consent || isPending}
                      aria-describedby={!consent ? 'submit-hint' : undefined}
                      aria-busy={isPending}
                      className="active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
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
                      <p id="submit-hint" className="text-xs text-muted-foreground">
                        Acepta el Aviso de Privacidad para poder enviar.
                      </p>
                    )}
                  </div>
                )}

                <div aria-live="polite">
                  {state.isSuccess && (
                    <p className="mt-2 flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                      <CircleCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                      ¡Gracias! Tu mensaje ha sido enviado con éxito.
                    </p>
                  )}
                </div>
              </form>
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
