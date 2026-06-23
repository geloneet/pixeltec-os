import { Brain, Zap, Megaphone, CalendarDays, Send } from 'lucide-react';
import Link from 'next/link';

const MODULES = [
  {
    href: '/crecimiento/brand-brain',
    icon: Brain,
    title: 'Brand Brain',
    description: 'Define la memoria de tu marca: servicios, cliente ideal, voz e identidad visual.',
  },
  {
    href: '/crecimiento/content-studio',
    icon: Zap,
    title: 'Content Studio',
    description: 'Genera posts individuales de alto impacto con IA en segundos.',
  },
  {
    href: '/crecimiento/campanas',
    icon: Megaphone,
    title: 'Campañas',
    description: 'Crea estrategias de contenido multi-post coordinadas con objetivo claro.',
  },
  {
    href: '/crecimiento/calendario',
    icon: CalendarDays,
    title: 'Calendario',
    description: 'Visualiza y programa tus publicaciones en un calendario mensual.',
  },
  {
    href: '/crecimiento/publisher',
    icon: Send,
    title: 'Publisher',
    description: 'Conecta Instagram y Facebook para publicar directamente desde PixelTEC OS.',
  },
];

export default function CrecimientoHubPage() {
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10">
      <header className="mb-10">
        <h1 className="font-poppins text-3xl font-bold tracking-tight text-zinc-50">
          Crecimiento
        </h1>
        <p className="mt-1 font-roboto text-sm text-zinc-500">
          Genera contenido de marca con IA. Alimentado por tu Brand Brain.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {MODULES.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-6 backdrop-blur-xl transition-colors hover:border-zinc-700/60 hover:bg-zinc-900/60"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800/60 group-hover:bg-cyan-500/10">
              <Icon className="h-5 w-5 text-zinc-400 group-hover:text-cyan-400" />
            </div>
            <p className="font-poppins font-semibold text-zinc-200">{title}</p>
            <p className="mt-1 font-roboto text-sm text-zinc-500">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
