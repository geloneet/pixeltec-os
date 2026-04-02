'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Header from '@/components/header';
import { Footer } from '@/components/ui/footer-section';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

// Navigation data for the sticky sidebar
const sections = [
  { id: 'responsable', title: '1. Identidad del Responsable' },
  { id: 'datos', title: '2. Datos Personales Recabados' },
  { id: 'finalidades', title: '3. Finalidades del Tratamiento' },
  { id: 'transferencia', title: '4. Transferencia de Datos' },
  { id: 'derechos-arco', title: '5. Derechos ARCO' },
  { id: 'cookies', title: '6. Uso de Cookies' },
  { id: 'cambios', title: '7. Modificaciones al Aviso' },
];

export default function AvisoDePrivacidadPage() {
  const [activeSection, setActiveSection] = useState('responsable');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-30% 0px -70% 0px' }
    );

    sections.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    });

    return () => {
      sections.forEach((section) => {
        const el = document.getElementById(section.id);
        if (el) observer.unobserve(el);
      });
    };
  }, []);


  return (
    <div className="bg-[#030303] text-white">
      <Header />
      <motion.main 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="container mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16 sm:pt-40 sm:pb-24"
      >
        {/* Hero */}
        <div className="max-w-5xl mx-auto mb-12 md:mb-16 pb-8 border-b border-white/10">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Aviso de Privacidad
          </h1>
          <p className="mt-4 text-lg text-zinc-400">
            Última actualización: Julio 2024
          </p>
        </div>

        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-12 md:gap-16">
          {/* Left Column (Sticky Nav) */}
          <aside className="w-full lg:w-64 lg:shrink-0">
            <nav className="lg:sticky lg:top-32">
              <ul className="space-y-3">
                {sections.map((section) => (
                  <li key={section.id}>
                    <Link
                      href={`#${section.id}`}
                      className={cn(
                        'block text-sm font-medium transition-colors',
                        activeSection === section.id
                          ? 'text-cyan-400'
                          : 'text-zinc-500 hover:text-white'
                      )}
                    >
                      {section.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          {/* Right Column (Content) */}
          <article className="prose prose-invert prose-lg max-w-3xl w-full text-zinc-400 leading-relaxed text-base">
            <section id="responsable" className="space-y-4 scroll-mt-32">
              <h2 className="text-2xl font-bold text-white">1. Identidad y Domicilio del Responsable</h2>
              <p>De conformidad con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares ("LFPDPPP"), PixelTEC ("El Responsable"), con domicilio en Puerto Vallarta, Jalisco, México, es responsable del tratamiento de sus datos personales.</p>
            </section>

            <section id="datos" className="space-y-4 mt-12 scroll-mt-32">
              <h2 className="text-2xl font-bold text-white">2. Datos Personales que Recabamos</h2>
              <p>Para la prestación de nuestros servicios de consultoría, desarrollo de software y automatización, podemos recabar los siguientes datos personales:</p>
              <ul className="list-disc pl-5">
                <li><strong className="text-white/80">Datos de Identificación:</strong> Nombre, correo electrónico, número de teléfono.</li>
                <li><strong className="text-white/80">Datos Laborales:</strong> Empresa para la que trabaja, puesto.</li>
                <li><strong className="text-white/80">Datos de Facturación:</strong> Razón social, Registro Federal de Contribuyentes (RFC), domicilio fiscal.</li>
                <li><strong className="text-white/80">Datos Técnicos:</strong> Para el desarrollo de proyectos, podemos tener acceso a información de sistemas, credenciales de APIs o bases de datos, siempre bajo estrictos acuerdos de confidencialidad.</li>
              </ul>
            </section>
            
            <section id="finalidades" className="space-y-4 mt-12 scroll-mt-32">
                <h2 className="text-2xl font-bold text-white">3. Finalidades del Tratamiento de Datos</h2>
                <p>Sus datos personales serán utilizados para las siguientes finalidades primarias, necesarias para el servicio solicitado:</p>
                 <ul className="list-disc pl-5">
                    <li>Proveer los servicios de consultoría, desarrollo de software y automatización.</li>
                    <li>Mantener comunicación sobre el avance de los proyectos.</li>
                    <li>Realizar el proceso de facturación y cobro.</li>
                    <li>Enviar propuestas de servicios y cotizaciones.</li>
                </ul>
                <p>Adicionalmente, podremos utilizar sus datos para finalidades secundarias como el envío de nuestro boletín informativo, del cual podrá darse de baja en cualquier momento.</p>
            </section>
            
            <section id="transferencia" className="space-y-4 mt-12 scroll-mt-32">
                <h2 className="text-2xl font-bold text-white">4. Transferencia de Datos Personales</h2>
                <p>PixelTEC no vende, cede ni transfiere sus datos personales a terceros con fines de lucro. Sus datos podrán ser compartidos con proveedores de servicios tecnológicos (tales como proveedores de cloud hosting como Vercel o AWS, y servicios de base de datos como Firebase) únicamente cuando sea estrictamente necesario para la implementación, operación y mantenimiento de las soluciones de software desarrolladas para usted.</p>
            </section>

            <section id="derechos-arco" className="space-y-4 mt-12 scroll-mt-32">
              <h2 className="text-2xl font-bold text-white">5. Derechos ARCO</h2>
              <p>Usted tiene derecho a conocer qué datos personales tenemos de usted, para qué los utilizamos y las condiciones del uso que les damos (Acceso). Asimismo, es su derecho solicitar la corrección de su información personal en caso de que esté desactualizada, sea inexacta o incompleta (Rectificación); que la eliminemos de nuestros registros cuando considere que no está siendo utilizada adecuadamente (Cancelación); así como oponerse al uso de sus datos para fines específicos (Oposición). Estos derechos se conocen como derechos ARCO.</p>
              <p>Para el ejercicio de cualquiera de los derechos ARCO, usted deberá presentar la solicitud respectiva a través de un correo electrónico a <a href="mailto:hola@pixeltec.mx" className="text-cyan-400 hover:underline">hola@pixeltec.mx</a>.</p>
            </section>
            
            <section id="cookies" className="space-y-4 mt-12 scroll-mt-32">
              <h2 className="text-2xl font-bold text-white">6. Uso de Cookies y Tecnologías de Rastreo</h2>
              <p>Nuestro sitio web utiliza cookies y otras tecnologías de rastreo con el fin de mejorar la experiencia del usuario y analizar el tráfico del sitio. Utilizamos cookies técnicas, funcionales y analíticas. Usted puede gestionar sus preferencias de cookies a través de la configuración de su navegador.</p>
            </section>
            
            <section id="cambios" className="space-y-4 mt-12 scroll-mt-32">
                <h2 className="text-2xl font-bold text-white">7. Modificaciones al Aviso de Privacidad</h2>
                <p>El presente aviso de privacidad puede sufrir modificaciones, cambios o actualizaciones derivadas de nuevos requerimientos legales o de nuestras propias necesidades. Nos comprometemos a mantenerlo informado sobre los cambios que pueda sufrir el presente aviso de privacidad, a través de nuestro sitio web.</p>
                <p>Para contactar a PixelTEC en relación con este aviso, por favor diríjase a <Link href="/contact" className="text-cyan-400 hover:underline">nuestra página de contacto</Link>.</p>
            </section>
          </article>
        </div>
      </motion.main>
      <Footer />
    </div>
  );
}
