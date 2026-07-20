"use client";

import { usePathname } from "next/navigation";

interface Props {
  children: React.ReactNode;
}

/**
 * StationTransition — crossfade CSS escopado entre estaciones (PF-X1 T5).
 *
 * El shell del proyecto (`[id]/layout.tsx`: header + riel de forja) NO se
 * mueve al navegar entre estaciones — solo el contenido de la estación hace
 * un crossfade corto. Esto es INDEPENDIENTE del `AnimatePresence`/`motion.div`
 * global del shell admin (F6B, `src/app/(admin)/layout.tsx`): ese sistema
 * sigue intacto y sin tocar; este componente añade una animación CSS propia,
 * escopada a `[data-product="pixelforge"]` (`.pfx-station-fade` en
 * `pixelforge-theme.css`), que se re-dispara cambiando la `key` del wrapper
 * con `usePathname()` — cada estación monta una instancia nueva del `div` y
 * su animación de entrada vuelve a correr.
 *
 * `prefers-reduced-motion: reduce` deja el crossfade estático (ver CSS).
 * Server-safe NO: necesita `usePathname`, de ahí el "use client" — igual que
 * `StepperBar`, es un puente delgado entre el layout server y el contenido.
 */
export function StationTransition({ children }: Props) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="pfx-station-fade">
      {children}
    </div>
  );
}
