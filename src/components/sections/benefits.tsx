import { Zap, Scaling, Lightbulb } from 'lucide-react';
import { CategoryList, type Category } from '@/components/ui/category-list';

const benefitsData: Category[] = [
  {
    id: 1,
    icon: <Zap size={40} strokeWidth={1.5} />,
    title: 'Eficiencia Operativa',
    subtitle: 'Reduce horas de trabajo manual mediante procesos automatizados.',
  },
  {
    id: 2,
    icon: <Scaling size={40} strokeWidth={1.5} />,
    title: 'Escalabilidad Segura',
    subtitle: 'Arquitectura robusta lista para crecer al ritmo de tus clientes.',
  },
  {
    id: 3,
    icon: <Lightbulb size={40} strokeWidth={1.5} />,
    title: 'Acompañamiento Estratégico',
    subtitle: 'No solo programamos; alineamos la tecnología con tus objetivos comerciales.',
  },
];

export default function BenefitsSection() {
  return (
    <section id="benefits">
      <CategoryList 
        title="Tecnología que impacta tu rentabilidad"
        categories={benefitsData}
        className="bg-[#0A0A0B]"
      />
    </section>
  );
}
