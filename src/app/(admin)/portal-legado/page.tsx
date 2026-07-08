import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/config";
import { PortalLegadoAdmin } from "@/components/portal-legado/PortalLegadoAdmin";

export const metadata: Metadata = {
  title: "Portal legado · PixelTEC OS",
  description: "Gestión de contraseñas del portal legado de clientes",
};

export default async function PortalLegadoPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?redirect=/portal-legado");
  if (session.user.role !== "admin") redirect("/hoy");

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Portal legado — contraseñas</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Fija o reinicia la contraseña de acceso al portal legado (<code>/portal</code>) de cada cliente.
        </p>
      </div>

      <PortalLegadoAdmin />
    </div>
  );
}
