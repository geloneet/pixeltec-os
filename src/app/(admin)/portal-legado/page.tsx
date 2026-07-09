import type { Metadata } from "next";
import { PortalLegadoAdmin } from "@/components/portal-legado/PortalLegadoAdmin";

export const metadata: Metadata = {
  title: "Portal — estado · PixelTEC OS",
  description: "Vista general del estado de portal por cliente",
};

// Restaurado tras el code review del 2026-07-09: mover la creación de
// portal a la ficha de cada cliente eliminó la única vista que mostraba de
// un vistazo qué clientes tienen portal activo/inactivo. Esta página cubre
// esa falta — es de solo lectura, las acciones viven en /clientes/[id].
export default function PortalLegadoPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Portal — estado</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Qué clientes tienen portal activo, inactivo o sin configurar. Para fijar contraseña, activar/desactivar,
          o rotar/revocar un link, abre el cliente.
        </p>
      </div>

      <PortalLegadoAdmin />
    </div>
  );
}
