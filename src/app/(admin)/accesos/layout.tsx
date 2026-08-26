import type { ReactNode } from "react";
import { assertModuleRouteEnabled } from "@/lib/modules/route-guard";

/**
 * Guard de módulo oculto (WO-2026-00088, patrón único): «Accesos» —la base de
 * conocimiento heredada del CRM— responde 404 dentro del shell mientras el
 * registro central lo marque oculto. Reactivar el módulo en
 * `src/lib/modules/registry.ts` vuelve a servir estas rutas.
 */
export default function AccesosModuleLayout({ children }: { children: ReactNode }) {
  assertModuleRouteEnabled("accesos");
  return <>{children}</>;
}
