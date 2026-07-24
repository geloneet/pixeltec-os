'use client';

import { useRef, useState, useTransition } from 'react';
import { subscribeToNewsletterAction } from '@/app/actions';
import { Input } from '@/components/ui/input';
import { CircleAlert, CircleCheck, Loader2 } from 'lucide-react';

/**
 * Pieza secundaria del footer. Mantiene aquí toda la lógica cliente para que
 * `footer-section` siga siendo un componente de composición.
 *
 * El backend (`subscribeToNewsletterAction`) conserva validación Zod, rate
 * limit, dedupe/reactivación, welcome email y unsubscribe; este componente
 * solo aporta UI y el honeypot, que por contrato es responsabilidad del form.
 */
export function NewsletterFooterForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  const honeypotRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) return; // evita doble envío

    // Honeypot: éxito silencioso, sin llamar al backend.
    if (honeypotRef.current?.value.trim()) {
      setStatus('success');
      setEmail('');
      return;
    }

    startTransition(async () => {
      const result = await subscribeToNewsletterAction(email);
      if (result.success) {
        setStatus('success');
        setEmail(''); // el campo solo se limpia en success
      } else {
        setStatus('error');
        // La action ya devuelve mensajes seguros para el visitante; no expone
        // detalles internos (falta de env, fallo de Resend, etc.).
        setErrorMessage(result.error ?? 'No pudimos procesar tu suscripción. Inténtalo más tarde.');
      }
    });
  };

  return (
    <div className="max-w-xs">
      <p className="text-sm font-medium text-foreground">
        Ideas prácticas para empresas que quieren escalar mejor.
      </p>
      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        {/* Honeypot: fuera del flujo visual y del orden de tabulación. */}
        <div
          aria-hidden="true"
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}
        >
          <label htmlFor="newsletter-hp">No completar este campo.</label>
          <input
            id="newsletter-hp"
            ref={honeypotRef}
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
          />
        </div>
        <label htmlFor="newsletter-email" className="sr-only">
          Tu correo electrónico para recibir el newsletter
        </label>
        <Input
          id="newsletter-email"
          type="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          disabled={isPending}
          aria-invalid={status === 'error'}
          aria-describedby="newsletter-status"
          className="h-11 border-border bg-transparent text-sm sm:h-9"
        />
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md border border-border px-3 sm:h-9 text-sm font-medium text-foreground transition-colors hover:border-cyan-500/50 hover:text-cyan-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:text-cyan-300"
        >
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          {isPending ? 'Enviando…' : 'Suscribirme'}
        </button>
      </form>
      <div id="newsletter-status" aria-live="polite">
        {status === 'success' && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-green-700 dark:text-green-400">
            <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ¡Listo! Ya estás en la lista. Revisa tu correo de bienvenida.
          </p>
        )}
        {status === 'error' && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {errorMessage}
          </p>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground/80">
        Automatización, software, arquitectura e inteligencia artificial.
      </p>
    </div>
  );
}
