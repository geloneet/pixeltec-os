'use client';

import Link from 'next/link';
import { ServiceScene, type ServiceSlug } from './registry';

/**
 * WO-2026-00342 — tarjeta "escena arriba, lectura abajo" (patrón de listado
 * tipo Airbnb) que enlaza a /services/[slug]. Es la misma tarjeta que estrenó
 * /services en WO-2026-00341, extraída aquí para que /about (Nuestros Pilares)
 * —y cualquier superficie futura— la consuma de una sola fuente. Sin icono:
 * la escena ya es la identidad visual del servicio; un glifo junto al título
 * sería una segunda voz compitiendo con ella.
 *
 * La escena corre sola al entrar al viewport y se pausa fuera de él (cada
 * escena lleva su propio `useSceneActive`); bajo prefers-reduced-motion se
 * queda en su fotograma final. Va aria-hidden porque el enlace ya se nombra
 * por el título: el `role="img"` de la escena no debe alargar el nombre
 * accesible del link.
 */
export interface ServiceSceneCardProps {
  slug: ServiceSlug;
  title: string;
  description: string;
}

export function ServiceSceneCard({ slug, title, description }: ServiceSceneCardProps) {
  return (
    <Link
      href={`/services/${slug}`}
      className="group block h-full rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
    >
      <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-[transform,border-color,box-shadow] duration-300 group-hover:-translate-y-2 group-hover:border-primary/40 group-hover:shadow-[0_24px_48px_-24px_rgba(33,150,243,0.35)] dark:group-hover:border-cyan-500/50 dark:group-hover:shadow-[0_24px_48px_-24px_rgba(34,211,238,0.35)]">
        <div aria-hidden="true" className="relative h-[252px] shrink-0 overflow-hidden bg-[#06080d]">
          <ServiceScene slug={slug} layout="stage" />
        </div>
        <div className="flex flex-1 flex-col p-7">
          <h3 className="text-xl font-bold tracking-tight text-foreground">{title}</h3>
          <p className="mt-2 leading-relaxed text-muted-foreground">{description}</p>
          <span className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold text-brand">
            Conocer más
            <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </span>
        </div>
      </article>
    </Link>
  );
}
