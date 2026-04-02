'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Header from '@/components/header';
import { Footer } from '@/components/ui/footer-section';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

// PIXELTEC - Pw
const sections = [
  { id: 'intro', title: '1. Introducción' },
  { id: 'servicios', title: '2. Nuestros Servicios' },
  { id: 'entregas', title: '3. Tiempos y Modificaciones' },
  { id: 'pagos', title: '4. Pagos y Facturación' },
  { id: 'propiedad', title: '5. Propiedad Intelectual' },
  { id: 'responsabilidad', title: '6. Límites de Responsabilidad' },
  { id: 'confidencialidad', title: '7. Confidencialidad' },
  { id: 'ley', title: '8. Ley Aplicable' },
];

export default function TerminosDeServicioPage() {
  const [activeSection, setActiveSection] = useState('intro');

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
            Términos de Servicio
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
            <section id="intro" className="space-y-4 scroll-mt-32">
              <h2 className="text-2xl font-bold text-white">1. Introducción</h2>
              <p>Estos Términos de Servicio ("Términos") rigen la relación profesional entre el cliente ("Cliente") y PixelTEC ("La Agencia"). Al contratar cualquiera de nuestros servicios, el Cliente acepta de manera íntegra e incondicional los presentes Términos. PixelTEC es una entidad comercial con sede en Puerto Vallarta, Jalisco, México.</p>
              <p>El propósito de estos Términos es establecer un marco claro, justo y transparente para la colaboración, asegurando que ambas partes tengan un entendimiento mutuo de las expectativas, responsabilidades y procesos involucrados en cada proyecto.</p>
            </section>

            <section id="servicios" className="space-y-4 mt-12 scroll-mt-32">
              <h2 className="text-2xl font-bold text-white">2. Nuestros Servicios</h2>
              <p>PixelTEC se especializa en las siguientes áreas de servicio, cuyos alcances se definirán en la cotización o propuesta de proyecto específica:</p>
              <h3 className="text-xl font-semibold text-white">a. Ecosistemas Web Avanzados</h3>
              <p>Desarrollo de aplicaciones web a medida, sitios corporativos y plataformas utilizando principalmente tecnologías como Next.js, React, y Firebase. El alcance incluirá las funcionalidades, secciones y arquitectura acordadas en la propuesta inicial.</p>
              <h3 className="text-xl font-semibold text-white">b. Automatización de Procesos con IA</h3>
              <p>Creación de scripts (principalmente en Python), bots para plataformas de mensajería (Telegram, WhatsApp) y herramientas de software para optimizar flujos de trabajo. El Cliente reconoce que la funcionalidad de estos servicios puede depender de APIs y plataformas de terceros.</p>
              <h3 className="text-xl font-semibold text-white">c. Consultoría Tecnológica</h3>
              <p>Análisis de sistemas, auditorías de procesos y diseño de estrategias de transformación digital. Los entregables de consultoría (reportes, hojas de ruta) se basarán en la información proporcionada por el Cliente y el análisis de La Agencia.</p>
            </section>
            
            <section id="entregas" className="space-y-4 mt-12 scroll-mt-32">
                <h2 className="text-2xl font-bold text-white">3. Tiempos de Entrega y Modificaciones</h2>
                <p>Los plazos de entrega estimados se especificarán en la propuesta de proyecto. Estos plazos son indicativos y pueden estar sujetos a cambios debido a retrasos en la entrega de información por parte del Cliente, solicitudes de cambio o imprevistos técnicos.</p>
                <p>Cualquier solicitud de modificación o adición de funcionalidades no contempladas en el alcance original será considerada como un "Cambio de Alcance". Dichos cambios serán evaluados, cotizados por separado y, de ser aprobados, podrían impactar el cronograma original del proyecto.</p>
            </section>
            
            <section id="pagos" className="space-y-4 mt-12 scroll-mt-32">
                <h2 className="text-2xl font-bold text-white">4. Pagos y Facturación</h2>
                <p>Salvo que se acuerde lo contrario, los proyectos se facturan con un pago inicial (generalmente del 50%) para comenzar el trabajo, y el pago restante a la entrega final del proyecto o en hitos predefinidos.</p>
                <p>Toda facturación se realizará de acuerdo con las disposiciones fiscales vigentes en México. Es responsabilidad del Cliente proporcionar sus datos fiscales correctos para la emisión del Comprobante Fiscal Digital por Internet (CFDI) correspondiente. Los precios no incluyen IVA, el cual será desglosado en la factura.</p>
            </section>

            <section id="propiedad" className="space-y-4 mt-12 scroll-mt-32">
              <h2 className="text-2xl font-bold text-white">5. Propiedad Intelectual</h2>
              <p>Una vez que el proyecto ha sido liquidado en su totalidad por el Cliente, la propiedad intelectual sobre el código fuente, diseños y otros entregables específicos del proyecto será transferida íntegramente al Cliente.</p>
              <p>No obstante, PixelTEC se reserva el derecho de utilizar el resultado final del proyecto (imágenes, descripciones funcionales, y el resultado visible) como parte de su portafolio de clientes y en materiales promocionales, siempre respetando la información confidencial del Cliente. La metodología, herramientas, y código reutilizable o librerías de base desarrolladas por La Agencia seguirán siendo propiedad de PixelTEC.</p>
            </section>
            
            <section id="responsabilidad" className="space-y-4 mt-12 scroll-mt-32">
              <h2 className="text-2xl font-bold text-white">6. Límites de Responsabilidad</h2>
              <p>PixelTEC no será responsable por fallas o interrupciones de servicios proveídos por terceros, tales como proveedores de hosting (ej. Vercel, AWS), APIs de redes sociales (ej. cambios en las políticas de Meta para WhatsApp o Telegram), o servicios de bases de datos (ej. caídas de Firebase).</p>
              <p>Nuestra responsabilidad se limita a la correcta implementación y funcionamiento del código y la arquitectura desarrollada por nosotros. Si bien nos esforzamos por construir soluciones robustas, no podemos garantizar el funcionamiento ininterrumpido de sistemas que dependen de factores externos fuera de nuestro control.</p>
            </section>
            
            <section id="confidencialidad" className="space-y-4 mt-12 scroll-mt-32">
                <h2 className="text-2xl font-bold text-white">7. Confidencialidad</h2>
                <p>Ambas partes se comprometen a mantener la confidencialidad de toda la información sensible (estrategias de negocio, datos de usuarios, secretos comerciales) compartida durante el transcurso del proyecto. Este acuerdo de confidencialidad permanecerá en vigor incluso después de la finalización del proyecto.</p>
            </section>

            <section id="ley" className="space-y-4 mt-12 scroll-mt-32">
              <h2 className="text-2xl font-bold text-white">8. Ley Aplicable y Jurisdicción</h2>
              <p>Estos Términos de Servicio se regirán e interpretarán de acuerdo con las leyes federales de los Estados Unidos Mexicanos. Para cualquier controversia que surja de la interpretación o cumplimiento de este acuerdo, las partes se someten expresamente a la jurisdicción y competencia de los tribunales de la ciudad de Puerto Vallarta, Jalisco, renunciando a cualquier otro fuero que por razón de sus domicilios presentes o futuros pudiera corresponderles.</p>
              <p>Para contactar a PixelTEC en relación con estos términos, por favor diríjase a <Link href="/contact" className="text-cyan-400 hover:underline">nuestra página de contacto</Link>.</p>
            </section>
          </article>
        </div>
      </motion.main>
      <Footer />
    </div>
  );
}
