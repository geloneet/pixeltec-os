"use client";

import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { useIsRestrictedRole } from "@/hooks/use-restricted-role";

/**
 * Pausa TODO SWR del shell del admin para un rol restringido (WO-2026-00055).
 *
 * El shell monta pollers SWR que el middleware deniega al reviewer — hoy
 * `useVpsStatus()` (`/api/vps/status`, 15 s) desde la paleta ⌘K; mañana
 * cualquier otro. `isPaused` en SWR 2 corta la revalidación INCLUIDA la
 * primera carga (no hay fetch, no hay 403 en consola, no hay error). Para
 * admin y staff `isPaused()` devuelve `false`: SWR se comporta exactamente
 * igual que sin este componente.
 *
 * Presentación, no seguridad: el 403 del middleware sigue ahí si algo pasa.
 */
export function RestrictedShellBoundary({ children }: { children: ReactNode }) {
  const restricted = useIsRestrictedRole();
  return <SWRConfig value={{ isPaused: () => restricted === true }}>{children}</SWRConfig>;
}
