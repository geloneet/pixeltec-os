import Link from 'next/link';
import { Truck, Droplets, Stethoscope, Hotel, ShoppingBag, Sun, ArrowRight } from 'lucide-react';

/**
 * Prueba social sectorial. Cada sector está respaldado por al menos un cliente
 * real documentado; no se muestran logos (no hay activos ni autorización) ni
 * métricas. Tipografía + iconografía ligera, deliberadamente sin cuadrícula de
 * tarjetas, para romper el patrón de las secciones vecinas.
 */
const SECTORS = [
  { icon: Truck, label: 'Logística y transporte' },
  { icon: Droplets, label: 'Distribución de agua' },
  { icon: Stethoscope, label: 'Salud dental' },
  { icon: Hotel, label: 'Hotelería' },
  { icon: ShoppingBag, label: 'Moda y comercio especializado' },
  { icon: Sun, label: 'Energía solar' },
] as const;

export default function IndustriesStrip() {
  return (
    <section aria-labelledby="industries-heading" className="bg-transparent py-14 md:py-16">
      <div className="container mx-auto max-w-5xl px-4 md:px-6">
        <h2
          id="industries-heading"
          className="text-center text-xl font-semibold tracking-tight text-foreground md:text-2xl"
        >
          Operamos dentro de industrias reales, no de casos hipotéticos
        </h2>

        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-4 md:gap-x-8">
          {SECTORS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2.5">
              <Icon className="h-4 w-4 shrink-0 text-primary dark:text-cyan-400" aria-hidden="true" />
              <span className="text-sm text-muted-foreground md:text-base">{label}</span>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-center">
          <Link
            href="/industrias"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-400 dark:text-cyan-400"
          >
            Ver cómo trabajamos en cada industria
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </p>
      </div>
    </section>
  );
}
