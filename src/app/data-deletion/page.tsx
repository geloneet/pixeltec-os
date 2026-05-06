'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Header from '@/components/header';
import { Footer } from '@/components/ui/footer-section';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const sections = [
  { id: 'derecho', title: '1. Tu Derecho de Cancelación' },
  { id: 'como-solicitar', title: '2. Cómo Solicitar el Borrado' },
  { id: 'que-incluir', title: '3. Qué Incluir en tu Solicitud' },
  { id: 'proceso', title: '4. Proceso y Plazos' },
  { id: 'excepciones', title: '5. Excepciones' },
];

export default function DataDeletionPage() {
  const [activeSection, setActiveSection] = useState('derecho');

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
            Eliminación de Datos
          </h1>
          <p className="mt-4 text-lg text-zinc-400">
            Conforme a la LFPDPPP y al RGPD, tienes derecho a solicitar la eliminación de tus datos personales.
          </p>
        </div>

        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-12 md:gap-16">
          {/* Sticky Nav */}
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

          {/* Content */}
          <article className="prose prose-invert prose-lg max-w-3xl w-full text-zinc-400 leading-relaxed text-base">

            <section id="derecho" className="space-y-4 scroll-mt-32">
              <h2 className="text-2xl font-bold text-white">1. Tu Derecho de Cancelación</h2>
              <p>
                De conformidad con la <strong className="text-white/80">Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)</strong>, tienes derecho a solicitar la cancelación (eliminación) de tus datos personales de nuestros registros cuando consideres que no están siendo utilizados adecuadamente o ya no son necesarios para la finalidad con la que fueron recabados.
              </p>
              <p>
                Este derecho forma parte de los denominados <strong className="text-white/80">Derechos ARCO</strong> (Acceso, Rectificación, Cancelación y Oposición), reconocidos también en el Reglamento General de Protección de Datos de la Unión Europea (RGPD).
              </p>
            </section>

            <section id="como-solicitar" className="space-y-4 mt-12 scroll-mt-32">
              <h2 className="text-2xl font-bold text-white">2. Cómo Solicitar el Borrado</h2>
              <p>
                Para solicitar la eliminación de tus datos personales, envía un correo electrónico a:
              </p>
              <div className="my-6 rounded-xl border border-white/10 bg-white/5 px-6 py-5">
                <p className="text-sm text-zinc-500 mb-1">Correo de contacto</p>
                <a
                  href="mailto:hola@pixeltec.mx"
                  className="text-xl font-semibold text-cyan-400 hover:underline"
                >
                  hola@pixeltec.mx
                </a>
              </div>
              <p>
                También puedes utilizar nuestra{' '}
                <Link href="/contact" className="text-cyan-400 hover:underline">
                  página de contacto
                </Link>{' '}
                para enviarnos tu solicitud.
              </p>
            </section>

            <section id="que-incluir" className="space-y-4 mt-12 scroll-mt-32">
              <h2 className="text-2xl font-bold text-white">3. Qué Incluir en tu Solicitud</h2>
              <p>Para que podamos atender tu solicitud de forma ágil, por favor incluye la siguiente información en tu correo:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Nombre completo</li>
                <li>Correo electrónico con el que te registraste o con el que nos contactaste</li>
                <li>Descripción de los datos que deseas eliminar (cuenta, historial de comunicaciones, datos de facturación, etc.)</li>
                <li>En el asunto del correo indica: <strong className="text-white/80">"Solicitud de eliminación de datos"</strong></li>
              </ul>
            </section>

            <section id="proceso" className="space-y-4 mt-12 scroll-mt-32">
              <h2 className="text-2xl font-bold text-white">4. Proceso y Plazos</h2>
              <p>Una vez recibida tu solicitud:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Confirmaremos la recepción en un plazo de <strong className="text-white/80">5 días hábiles</strong>.</li>
                <li>Evaluaremos y procesaremos la solicitud en un máximo de <strong className="text-white/80">20 días hábiles</strong>, conforme a lo establecido en la LFPDPPP.</li>
                <li>Te notificaremos por correo electrónico una vez que los datos hayan sido eliminados o, en su caso, te informaremos si existe alguna causa legal que impida la cancelación.</li>
              </ul>
            </section>

            <section id="excepciones" className="space-y-4 mt-12 scroll-mt-32">
              <h2 className="text-2xl font-bold text-white">5. Excepciones</h2>
              <p>
                La cancelación no procederá cuando los datos personales sean necesarios para cumplir con una obligación legal o contractual vigente, para el ejercicio o defensa de reclamaciones, o cuando exista otro impedimento previsto en la ley.
              </p>
              <p>
                Para más información sobre cómo tratamos tus datos, consulta nuestro{' '}
                <Link href="/aviso-de-privacidad" className="text-cyan-400 hover:underline">
                  Aviso de Privacidad
                </Link>.
              </p>
            </section>

          </article>
        </div>
      </motion.main>
      <Footer />
    </div>
  );
}
