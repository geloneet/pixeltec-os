'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, MapPin, MessageCircle, Phone, Send, LoaderCircle } from 'lucide-react';
import { useFormStatus } from 'react-dom';

import Header from '@/components/header';
import { Footer } from '@/components/ui/footer-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { submitContactForm } from '@/app/actions';
import { SocialLinks } from '@/components/ui/social-links';
import { ShinyButton } from '@/components/ui/shiny-button';
import { ObfuscatedMailto } from '@/components/ui/obfuscated-mailto';
import { SessionIdField } from '@/components/analytics/session-id-field';
import { SITE } from '@/lib/site-config';

// UX-02 (WO-2026-00268): la tarjeta «Teléfono» mostraba el número pero
// enlazaba a WhatsApp — quien quisiera llamar tenía que copiarlo a mano, y en
// móvil un número sin `tel:` no es marcable. Ahora son dos tarjetas distintas:
// llamar y escribir por WhatsApp son intenciones distintas. «Oficina» deja de
// ser un `<a href="#">` (enlace muerto que el teclado y los lectores de
// pantalla anunciaban como accionable) y pasa a texto.
const contactInfo = [
  { icon: MapPin, title: 'Oficina', value: `${SITE.address.locality}, ${SITE.address.region}`, href: null },
  { icon: Phone, title: 'Teléfono', value: SITE.phone.display, href: `tel:${SITE.phone.e164}` },
  {
    icon: MessageCircle,
    title: 'WhatsApp',
    value: 'Escríbenos y te respondemos hoy',
    href: 'https://api.whatsapp.com/send?phone=523221378336&text=Hola,%20quiero%20informaci%C3%B3n.',
  },
] satisfies ReadonlyArray<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  href: string | null;
}>;

const CONTACT_CARD_CLASS =
  'bg-card border border-border p-6 rounded-2xl backdrop-blur-md transition-colors duration-300 flex items-center gap-6';

const initialState = {
  message: '',
  isSuccess: false,
  errors: undefined,
};

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <ShinyButton
      type="submit"
      className="w-full"
      disabled={pending || !!disabled}
    >
      {pending ? (
        <LoaderCircle className="animate-spin h-6 w-6" />
      ) : (
        <>
          Enviar Mensaje <Send className="ml-2 h-5 w-5" />
        </>
      )}
    </ShinyButton>
  );
}

export default function ContactPage() {
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
      toast({
        title: '¡Mensaje Enviado!',
        description: 'Gracias por contactarnos. Te responderemos a la brevedad.',
      });
    }
  }, [state, toast]);

  return (
    <div className="bg-background text-foreground">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16 sm:pt-40 sm:pb-24">
        {/* Header */}
        <motion.div 
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="text-center mb-12 md:mb-16"
        >
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
                Iniciemos la <span className="text-brand">Transformación</span>
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg text-muted-foreground md:text-xl leading-relaxed">
                Cuéntanos sobre tu desafío operativo o proyecto tecnológico. Nuestro equipo en Puerto Vallarta está listo para diseñar tu próxima solución escalable.
            </p>
        </motion.div>

        {/* Main Grid */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16">
            
            {/* Left Column */}
            <motion.div 
                initial={{ x: -20 }}
                animate={{ x: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                className="lg:col-span-2 flex flex-col justify-between"
            >
                <div className="space-y-6">
                    <ObfuscatedMailto
                        email="contacto@pixeltec.mx"
                        className="block bg-card border border-border p-6 rounded-2xl backdrop-blur-md hover:border-brand-blue/30 transition-colors duration-300 flex items-center gap-6"
                    >
                        <Mail className="h-8 w-8 text-brand" />
                        <div>
                            <h3 className="font-semibold text-foreground">Email</h3>
                            <p className="text-muted-foreground">contacto@pixeltec.mx</p>
                        </div>
                    </ObfuscatedMailto>
                    {contactInfo.map((item) => {
                        const body = (
                            <>
                                <item.icon className="h-8 w-8 text-brand" />
                                <div>
                                    <h3 className="font-semibold text-foreground">{item.title}</h3>
                                    <p className="text-muted-foreground">{item.value}</p>
                                </div>
                            </>
                        );
                        if (!item.href) {
                            return (
                                <div key={item.title} className={CONTACT_CARD_CLASS}>
                                    {body}
                                </div>
                            );
                        }
                        const external = item.href.startsWith('http');
                        return (
                            <a
                                href={item.href}
                                key={item.title}
                                className={`${CONTACT_CARD_CLASS} hover:border-brand-blue/30`}
                                target={external ? '_blank' : undefined}
                                rel={external ? 'noopener noreferrer' : undefined}
                            >
                                {body}
                            </a>
                        );
                    })}
                </div>
                <div className="mt-12 md:mt-24 lg:mt-32">
                  <SocialLinks />
                </div>
            </motion.div>

            {/* Right Column */}
            <motion.div 
                initial={{ x: 20 }}
                animate={{ x: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.4 }}
                className="lg:col-span-3 bg-card/80 border border-border rounded-2xl p-8 md:p-12 backdrop-blur-lg shadow-[0_18px_60px_-30px_rgba(33,150,243,0.25)] dark:bg-[#0A0A0A]/80 dark:shadow-[0_0_40px_rgba(0,240,255,0.05)]"
            >
                <form ref={formRef} action={formAction} className="space-y-6">
                    {/* WO-2026-00214: une el lead con su rastro de contenido. */}
                    <SessionIdField />
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
                    {/* UX-02: `autoComplete` deja que el navegador rellene
                        nombre, correo y empresa — menos fricción en móvil, que
                        es de donde llega la mayoría del tráfico. */}
                    <div>
                        <Label htmlFor="name" className="text-foreground/80">Nombre Completo</Label>
                        <Input id="name" name="name" required autoComplete="name" className="mt-2 bg-muted/40 text-foreground focus-visible:ring-primary focus-visible:border-primary dark:bg-black/50 dark:border-white/10 dark:focus-visible:ring-cyan-500 dark:focus-visible:border-cyan-500" />
                         {state.errors?.name && <p className="text-sm text-destructive mt-1">{state.errors.name[0]}</p>}
                    </div>
                     <div>
                        <Label htmlFor="email" className="text-foreground/80">Correo Electrónico</Label>
                        <Input id="email" name="email" type="email" required autoComplete="email" className="mt-2 bg-muted/40 text-foreground focus-visible:ring-primary focus-visible:border-primary dark:bg-black/50 dark:border-white/10 dark:focus-visible:ring-cyan-500 dark:focus-visible:border-cyan-500" />
                         {state.errors?.email && <p className="text-sm text-destructive mt-1">{state.errors.email[0]}</p>}
                    </div>
                     <div>
                        <Label htmlFor="empresa" className="text-foreground/80">Empresa (Opcional)</Label>
                        <Input id="empresa" name="empresa" autoComplete="organization" className="mt-2 bg-muted/40 text-foreground focus-visible:ring-primary focus-visible:border-primary dark:bg-black/50 dark:border-white/10 dark:focus-visible:ring-cyan-500 dark:focus-visible:border-cyan-500" />
                    </div>
                    <div>
                        <Label htmlFor="message" className="text-foreground/80">Cuéntanos sobre tu proyecto</Label>
                        <Textarea id="message" name="message" required rows={4} className="mt-2 bg-muted/40 text-foreground focus-visible:ring-primary focus-visible:border-primary dark:bg-black/50 dark:border-white/10 dark:focus-visible:ring-cyan-500 dark:focus-visible:border-cyan-500" />
                        {state.errors?.message && <p className="text-sm text-destructive mt-1">{state.errors.message[0]}</p>}
                    </div>
                    <div className="flex items-start gap-3">
                        <input type="hidden" name="consent" value={consent ? 'on' : ''} />
                        <Checkbox
                          id="contact-consent"
                          checked={consent}
                          onCheckedChange={(checked) => setConsent(Boolean(checked))}
                          className="mt-0.5 border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:data-[state=checked]:bg-cyan-500 dark:data-[state=checked]:border-cyan-500"
                        />
                        <Label htmlFor="contact-consent" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                          He leído y acepto el{' '}
                          <Link
                            href="/aviso-de-privacidad"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand hover:underline"
                          >
                            Aviso de Privacidad
                          </Link>
                        </Label>
                    </div>
                    {state.errors?.consent && (
                      <p className="text-sm text-destructive -mt-2">{state.errors.consent[0]}</p>
                    )}
                    <div className="pt-4">
                        <SubmitButton disabled={!consent} />
                    </div>
                </form>
            </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
