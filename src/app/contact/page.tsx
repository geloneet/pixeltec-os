'use client';

import { useActionState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mail, MapPin, Phone, Send, LoaderCircle } from 'lucide-react';
import { useFormStatus } from 'react-dom';

import Header from '@/components/header';
import { Footer } from '@/components/ui/footer-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { submitContactForm } from '@/app/actions';
import { SocialLinks } from '@/components/ui/social-links';
import { ShinyButton } from '@/components/ui/shiny-button';

const contactInfo = [
  { icon: Mail, title: 'Email', value: 'hola@pixeltec.mx', href: 'mailto:hola@pixeltec.mx' },
  { icon: MapPin, title: 'Oficina', value: 'Puerto Vallarta, Jalisco', href: '#' },
  { icon: Phone, title: 'Teléfono', value: '+52 (322) 124-6680', href: 'https://api.whatsapp.com/send?phone=523221246680&text=Hola,%20quiero%20informaci%C3%B3n.' },
];

const initialState = {
  message: '',
  isSuccess: false,
  errors: undefined,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <ShinyButton 
      type="submit" 
      className="w-full"
      disabled={pending}
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
    <div className="bg-[#030303] text-white">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16 sm:pt-40 sm:pb-24">
        {/* Header */}
        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="text-center mb-12 md:mb-16"
        >
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
                Iniciemos la <span className="text-brand-blue">Transformación</span>
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg text-zinc-400 md:text-xl leading-relaxed">
                Cuéntanos sobre tu desafío operativo o proyecto tecnológico. Nuestro equipo en Puerto Vallarta está listo para diseñar tu próxima solución escalable.
            </p>
        </motion.div>

        {/* Main Grid */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16">
            
            {/* Left Column */}
            <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                className="lg:col-span-2 flex flex-col justify-between"
            >
                <div className="space-y-6">
                    {contactInfo.map((item) => (
                        <a 
                            href={item.href} 
                            key={item.title} 
                            className="block bg-[#0A0A0A] border border-white/10 p-6 rounded-2xl backdrop-blur-md hover:border-brand-blue/30 transition-colors duration-300 flex items-center gap-6"
                            target={item.href.startsWith('http') ? '_blank' : undefined}
                            rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                        >
                            <item.icon className="h-8 w-8 text-brand-blue" />
                            <div>
                                <h3 className="font-semibold text-white">{item.title}</h3>
                                <p className="text-white/70">{item.value}</p>
                            </div>
                        </a>
                    ))}
                </div>
                <div className="mt-12 md:mt-24 lg:mt-32">
                  <SocialLinks />
                </div>
            </motion.div>

            {/* Right Column */}
            <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.4 }}
                className="lg:col-span-3 bg-[#0A0A0A]/80 border border-white/10 rounded-2xl p-8 md:p-12 backdrop-blur-lg shadow-[0_0_40px_rgba(0,240,255,0.05)]"
            >
                <form ref={formRef} action={formAction} className="space-y-6">
                    <div>
                        <Label htmlFor="name" className="text-white/80">Nombre Completo</Label>
                        <Input id="name" name="name" required className="mt-2 bg-black/50 border-white/10 text-white focus-visible:ring-cyan-500 focus-visible:border-cyan-500" />
                         {state.errors?.name && <p className="text-sm text-destructive mt-1">{state.errors.name[0]}</p>}
                    </div>
                     <div>
                        <Label htmlFor="email" className="text-white/80">Correo Electrónico</Label>
                        <Input id="email" name="email" type="email" required className="mt-2 bg-black/50 border-white/10 text-white focus-visible:ring-cyan-500 focus-visible:border-cyan-500" />
                         {state.errors?.email && <p className="text-sm text-destructive mt-1">{state.errors.email[0]}</p>}
                    </div>
                     <div>
                        <Label htmlFor="empresa" className="text-white/80">Empresa (Opcional)</Label>
                        <Input id="empresa" name="empresa" className="mt-2 bg-black/50 border-white/10 text-white focus-visible:ring-cyan-500 focus-visible:border-cyan-500" />
                    </div>
                    <div>
                        <Label htmlFor="message" className="text-white/80">Cuéntanos sobre tu proyecto</Label>
                        <Textarea id="message" name="message" required rows={4} className="mt-2 bg-black/50 border-white/10 text-white focus-visible:ring-cyan-500 focus-visible:border-cyan-500" />
                        {state.errors?.message && <p className="text-sm text-destructive mt-1">{state.errors.message[0]}</p>}
                    </div>
                    <div className="pt-4">
                        <SubmitButton />
                    </div>
                </form>
            </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
