'use client';
import { TestimonialsWithMarquee } from '@/components/ui/testimonials-with-marquee';

const WomanIcon = () => (
  <div className="w-16 h-16 rounded-full bg-[#0A0A0A] border-2 border-zinc-800 flex items-center justify-center overflow-hidden">
    <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-brand-blue" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M19.36 17.14C18.17 15.82 16.14 15 14 15H10C7.86 15 5.83 15.82 4.64 17.14C4.22 17.61 4.29 18.3 4.79 18.67C6.67 20.08 9.17 21 12 21C14.83 21 17.33 20.08 19.21 18.67C19.71 18.3 19.78 17.61 19.36 17.14Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
);

const ManIcon = () => (
  <div className="w-16 h-16 rounded-full bg-[#0A0A0A] border-2 border-zinc-800 flex items-center justify-center overflow-hidden">
    <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-brand-blue" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M19.36 17.14C18.17 15.82 16.14 15 14 15H10C7.86 15 5.83 15.82 4.64 17.14C4.22 17.61 4.29 18.3 4.79 18.67C6.67 20.08 9.17 21 12 21C14.83 21 17.33 20.08 19.21 18.67C19.71 18.3 19.78 17.61 19.36 17.14Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
);

const testimoniosData = [
  { id: 1, rating: 5, text: "PixelTEC transformó por completo nuestra presencia digital. El nuevo sistema de reservas a medida no solo es elegante, sino que optimizó nuestras operaciones diarias de manera increíble.", name: "Aidee García", role: "Directora, Villa Nogal", gender: "female" },
  { id: 2, rating: 5, text: "La automatización de nuestros pedidos y la reestructuración de la gestión logística nos ha ahorrado incontables horas. Ahora atendemos a nuestros clientes de forma mucho más rápida y sin errores.", name: "Juan Antonio Sánchez", role: "Director General, Pipas Tondoroque", gender: "male" },
  { id: 3, rating: 5, text: "Digitalizar un negocio tradicional parecía un reto imposible, pero el equipo diseñó un ecosistema a la medida que nos permitió modernizarnos, escalar ventas y tener control total.", name: "Juan Sánchez", role: "Fundador, Materiales de Barro", gender: "male" },
  { id: 4, rating: 5, text: "La arquitectura web y el control de inventario que desarrollaron para nosotros nos ha dado una ventaja competitiva enorme. La plataforma es robusta, rápida y exactamente lo que necesitábamos.", name: "Francisco Arredondo", role: "CEO, Barro Stock", gender: "male" },
  { id: 5, rating: 5, text: "El sistema de gestión integral para la clínica y el rediseño del sitio web superaron todas nuestras expectativas. Hemos mejorado nuestra captación de pacientes notablemente.", name: "Pollet Niebla", role: "Fundadora, Smilemore", gender: "female" }
];

const testimonials = testimoniosData.map(t => ({
  text: t.text,
  author: {
    name: t.name,
    title: t.role,
    icon: t.gender === 'female' ? <WomanIcon /> : <ManIcon />,
  }
}));

export default function TestimonialsSection() {
  return (
    <section id="testimonials" className="bg-[#0A0A0B]">
      <TestimonialsWithMarquee
        title="Empresas que ya escalaron con nosotros"
        description="No solo creamos software, construimos alianzas. Nuestra mayor satisfacción es ver el éxito medible de nuestros clientes."
        testimonials={testimonials}
      />
    </section>
  );
}
