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
import { Mail, Phone, MapPin } from 'lucide-react';
import { ShinyButton } from '../ui/shiny-button';

const initialState = {
  message: '',
  isSuccess: false,
  errors: undefined,
};

const contactInfo = [
  {
      icon: Mail,
      label: 'Email',
      value: 'hola@pixeltec.mx',
  },
  {
      icon: Phone,
      label: 'Teléfono',
      value: '+52 (322) 124-6680',
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
    <section id="contact" className="py-20 md:py-32 bg-[#0A0A0B]">
      <div className="container mx-auto px-4 md:px-6">
        <ContactCard
            title="¿Listo para automatizar tu éxito?"
            description="Hablemos de tu próximo gran desafío tecnológico. Llena el formulario y nuestro equipo de consultores se pondrá en contacto contigo a la brevedad."
            contactInfo={contactInfo}
        >
            <form ref={formRef} action={formAction} className="w-full space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" name="name" placeholder="Tu nombre" required className="bg-transparent border-white/20 focus:border-primary"/>
                {state.errors?.name && <p className="text-sm text-destructive mt-1">{state.errors.name[0]}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="tu@email.com" required className="bg-transparent border-white/20 focus:border-primary"/>
                {state.errors?.email && <p className="text-sm text-destructive mt-1">{state.errors.email[0]}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Mensaje</Label>
                <Textarea id="message" name="message" placeholder="Cuéntanos sobre tu proyecto..." required rows={4} className="bg-transparent border-white/20 focus:border-primary"/>
                {state.errors?.message && <p className="text-sm text-destructive mt-1">{state.errors.message[0]}</p>}
              </div>
              <div className="flex items-start gap-3 pt-1">
                <input type="hidden" name="consent" value={consent ? 'on' : ''} />
                <Checkbox
                  id="contact-consent"
                  checked={consent}
                  onCheckedChange={(checked) => setConsent(Boolean(checked))}
                  className="mt-0.5 border-white/20 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                />
                <Label htmlFor="contact-consent" className="text-sm text-zinc-400 leading-relaxed cursor-pointer">
                  He leído y acepto el{' '}
                  <Link href="/aviso-de-privacidad" target="_blank" className="text-cyan-400 hover:underline">
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
                  Agendar Diagnóstico de Innovación
                </ShinyButton>
              </div>
               {state.isSuccess && (
                <p className="text-sm text-green-400 mt-2 text-center">
                  ¡Gracias! Tu mensaje ha sido enviado con éxito.
                </p>
              )}
            </form>
        </ContactCard>
      </div>
    </section>
  );
}
