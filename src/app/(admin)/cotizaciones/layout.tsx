import type { ReactNode } from "react";
import { assertModuleRouteEnabled } from "@/lib/modules/route-guard";

/**
 * Guard de módulo (WO-2026-00132, mismo patrón de WO-2026-00088): "Cotizaciones"
 * responde 404 dentro del shell mientras el registro central lo marque oculto.
 */
export default function CotizacionesModuleLayout({ children }: { children: ReactNode }) {
  assertModuleRouteEnabled("cotizaciones");
  return <>{children}</>;
}
