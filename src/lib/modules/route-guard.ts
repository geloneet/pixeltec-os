import { notFound } from "next/navigation";
import { isModuleRouteEnabled, type ModuleId } from "./registry";

/**
 * Guard de ruta de los módulos ocultos (WO-2026-00088). PATRÓN ÚNICO: cada
 * módulo oculto tiene un `layout.tsx` (Server Component) en la raíz de su
 * ruta que llama a esta función. Mientras el registro marque el módulo como
 * `hidden`/`legacy`, cualquier URL del módulo responde 404 dentro del shell
 * del admin (`src/app/(admin)/not-found.tsx`), sin exponer nada al público:
 * el middleware de sesión (`PROTECTED_PATHS`) sigue actuando antes.
 *
 * Reactivar el módulo en el registro vuelve a servir la ruta sin tocar este
 * archivo ni el layout.
 */
export function assertModuleRouteEnabled(id: ModuleId): void {
  if (!isModuleRouteEnabled(id)) notFound();
}
