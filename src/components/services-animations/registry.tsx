'use client';

import type { ComponentType } from 'react';
import { WhatsappAiAgentBg } from './whatsapp-ai-agent-bg';
import { SiteAppBuildBg } from './site-app-build-bg';
import { ConsultingMascotBg } from './consulting-mascot-bg';
import type { SceneProps } from './scene-frame';

/**
 * WO-2026-00341 — única fuente del mapeo slug de servicio → escena animada.
 * La consumen el home (tarjetas), el modal de cada servicio, /services y
 * /services/[slug]. Si aparece un cuarto servicio, se registra aquí y todas
 * las superficies lo muestran; nadie duplica este diccionario.
 */
export const SERVICE_SLUGS = ['automatizacion', 'ecosistemas-web', 'consultoria'] as const;
export type ServiceSlug = (typeof SERVICE_SLUGS)[number];

export const SERVICE_SCENES: Record<ServiceSlug, ComponentType<SceneProps>> = {
  automatizacion: WhatsappAiAgentBg,
  'ecosistemas-web': SiteAppBuildBg,
  consultoria: ConsultingMascotBg,
};

export function isServiceSlug(slug: string): slug is ServiceSlug {
  return (SERVICE_SLUGS as readonly string[]).includes(slug);
}

/**
 * Escena del servicio `slug`. Rellena el contenedor padre (que debe ser
 * `relative` con alto propio). Un slug desconocido no rompe la página: no
 * pinta nada. Arranca sola al entrar al viewport, se pausa fuera de él y en
 * la pestaña oculta; con `prefers-reduced-motion` o `poster` muestra el
 * fotograma final (ver `useSceneActive`).
 */
export function ServiceScene({ slug, ...props }: SceneProps & { slug: string }) {
  if (!isServiceSlug(slug)) return null;
  const Scene = SERVICE_SCENES[slug];
  return <Scene {...props} />;
}
