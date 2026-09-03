import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth/session";
import PageHeader from "@/components/dashboard/PageHeader";
import { countLeadsByStatus, listClientOptions, listLeads } from "@/lib/leads/admin-queries";
import { LeadsTable } from "./leads-table";

/**
 * Bandeja de leads (WO-2026-00214, A13).
 *
 * Antes de este WO la tabla `leads` no tenía ninguna superficie en el panel:
 * los leads entraban por el formulario público y sólo se veían por el correo de
 * notificación. Esta pantalla es el mínimo para trabajarlos — mover el estado y
 * vincularlos a un cliente — que es lo que cierra el embudo del módulo SEO &
 * Contenido: sin la vinculación a `clients`, el embudo termina en "lead" y
 * nunca llega al dinero (que vive en `sales`, ADR-0057).
 *
 * Diseño: docs/superpowers/specs/2026-09-03-seo-contenido-design.md
 */

export const metadata: Metadata = {
  title: "Leads — Pixeltec.mx",
};

/** Datos operativos en vivo; una versión cacheada mostraría estados viejos. */
export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const ownerId = await getSessionUserId();
  if (!ownerId) redirect("/login?redirect=/clientes/leads");

  const [rows, clients, counts] = await Promise.all([
    listLeads(),
    listClientOptions(),
    countLeadsByStatus(),
  ]);

  // Serialización a la frontera cliente: los `Date` no cruzan a un componente
  // de cliente sin convertirse, y hacerlo aquí evita un `toISOString()` disperso
  // por la tabla.
  const serialized = rows.map((lead) => ({
    id: lead.id,
    source: lead.source,
    status: lead.status,
    email: lead.email,
    name: lead.name,
    empresa: lead.empresa,
    createdAt: lead.createdAt.toISOString(),
    qualifiedAt: lead.qualifiedAt ? lead.qualifiedAt.toISOString() : null,
    convertedAt: lead.convertedAt ? lead.convertedAt.toISOString() : null,
    clientId: lead.clientId,
    clientName: lead.clientName,
    firstContentPath: lead.firstContentPath,
    landingPath: lead.landingPath,
  }));

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-8">
      <PageHeader
        title="Leads"
        description="Demanda entrante: de qué contenido vino, en qué estado está y a qué cliente corresponde"
      />

      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {(
          [
            ["Total", counts.total],
            ["Nuevos", counts.new],
            ["Contactados", counts.contacted],
            ["Calificados", counts.qualified],
            ["Perdidos", counts.lost],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 rounded-xl border border-border bg-card p-4">
        <LeadsTable leads={serialized} clients={clients} />
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        &laquo;Convertido&raquo; se deriva de la primera venta del cliente vinculado — no se escribe a
        mano. El ingreso atribuible a un contenido sale de esa misma cadena
        (lead → cliente → ventas), nunca de una copia del monto en el lead.
      </p>
    </div>
  );
}
