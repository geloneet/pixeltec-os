'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { submitContactForm } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ContactCard } from '@/components/ui/contact-card';
import { Mail, Phone, MapPin, Sparkles } from 'lucide-react';
import { ShinyButton } from '../ui/shiny-button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DiagnosticWizard } from '@/components/diagnostico/DiagnosticWizard';
import { ObfuscatedMailto } from '@/components/ui/obfuscated-mailto';

const initialState = {
  message: '',
  isSuccess: false,
  errors: undefined,
};

const contactInfo = [
  {
      icon: Mail,
      label: 'Email',
      // ObfuscatedMailto, no texto plano: Cloudflare reescribe cualquier
      // email visible en el HTML crudo (Scrape Shield) antes de que React
      // hidrate, lo que producía "Hydration failed" en esta sección.
      value: (
        <ObfuscatedMailto email="contacto@pixeltec.mx" className="text-muted-foreground hover:text-foreground transition-colors">
          contacto@pixeltec.mx
        </ObfuscatedMailto>
      ),
  },
  {
      icon: Phone,
      label: 'Teléfono',
      value: '+52 (322) 137-8336',
  },
  {
      icon: MapPin,
      label: 'Oficina',
      value: 'Puerto Vallarta, Jalisco'
  }
];

export default function ContactSection() {
  const [state, formAction] = useActionState(submitContactForm, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [consent, setConsent] = useState(false);
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);

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
    }
  }, [state, toast]);

  return (
    <section id="contact" className="py-20 md:py-32 bg-background dark:bg-[#0A0A0B]">
      <div className="container mx-auto px-4 md:px-6">
        <div className="mb-8 rounded-2xl border border-cyan-500/20 bg-cyan-950/10 p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-5 sm:gap-6 justify-between">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="hidden sm:flex p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/20 shrink-0">
              <Sparkles className="h-6 w-6 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Diagnóstico Inteligente</h3>
              <p className="text-sm text-zinc-400">
                Responde 5 preguntas y recibe una recomendación personalizada en minutos.
              </p>
            </div>
          </div>
          <ShinyButton type="button" onClick={() => setDiagnosticOpen(true)} className="shrink-0 px-6">
            Iniciar Diagnóstico Inteligente
          </ShinyButton>
        </div>

        <Dialog open={diagnosticOpen} onOpenChange={setDiagnosticOpen}>
          <DialogContent className="max-w-2xl bg-transparent border-none shadow-none p-0">
            <DialogTitle className="sr-only">Diagnóstico Inteligente PixelTEC</DialogTitle>
            <DialogDescription className="sr-only">
              Responde unas preguntas y recibe una recomendación personalizada para tu empresa.
            </DialogDescription>
            <DiagnosticWizard variant="modal" onClose={() => setDiagnosticOpen(false)} />
          </DialogContent>
        </Dialog>

        <ContactCard
            title="¿Listo para automatizar tu éxito?"
            description="Hablemos de tu próximo gran desafío tecnológico. Llena el formulario y nuestro equipo de consultores se pondrá en contacto contigo a la brevedad."
            contactInfo={contactInfo}
        >
            <form ref={formRef} action={formAction} className="w-full space-y-6">
              {/* Honeypot — hidden from humans (incl. screen readers), tempting for naive bots. */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
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
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" name="name" placeholder="Tu nombre" required className="bg-transparent border-border focus:border-primary"/>
                {state.errors?.name && <p className="text-sm text-destructive mt-1">{state.errors.name[0]}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="tu@email.com" required className="bg-transparent border-border focus:border-primary"/>
                {state.errors?.email && <p className="text-sm text-destructive mt-1">{state.errors.email[0]}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Mensaje</Label>
                <Textarea id="message" name="message" placeholder="Cuéntanos sobre tu proyecto..." required rows={4} className="bg-transparent border-border focus:border-primary"/>
                {state.errors?.message && <p className="text-sm text-destructive mt-1">{state.errors.message[0]}</p>}
              </div>
              <div className="flex items-start gap-3 pt-1">
                <input type="hidden" name="consent" value={consent ? 'on' : ''} />
                <Checkbox
                  id="contact-consent"
                  checked={consent}
                  onCheckedChange={(checked) => setConsent(Boolean(checked))}
                  className="mt-0.5 border-border data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                />
                <Label htmlFor="contact-consent" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                  He leído y acepto el{' '}
                  <Link href="/aviso-de-privacidad" target="_blank" className="text-primary dark:text-cyan-400 hover:underline">
                    Aviso de Privacidad
                  </Link>
                </Label>
              </div>
              {state.errors?.consent && (
                <p className="text-sm text-destructive -mt-1">{state.errors.consent[0]}</p>
              )}
              <div className="pt-2">
                <ShinyButton
                  type="submit"
                  className="w-full"
                  disabled={!consent}
                >
                  Enviar mensaje
                </ShinyButton>
              </div>
               {state.isSuccess && (
                <p className="text-sm text-green-700 dark:text-green-400 mt-2 text-center">
                  ¡Gracias! Tu mensaje ha sido enviado con éxito.
                </p>
              )}
            </form>
        </ContactCard>
      </div>
    </section>
  );
}
