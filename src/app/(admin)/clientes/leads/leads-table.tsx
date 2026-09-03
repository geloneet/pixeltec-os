"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { linkLeadToClientAction, setLeadStatusAction } from "@/lib/leads/admin-actions";

/**
 * Bandeja de leads (WO-2026-00214, A13) — lo mínimo para trabajarlos.
 *
 * Dos operaciones y ninguna más: mover el estado y vincular a un cliente. No
 * hay edición del contenido del lead a propósito: lo que el visitante escribió
 * es evidencia de lo que pidió, y permitir reescribirlo desde el panel la
 * destruiría sin dejar rastro.
 */

export interface LeadRowView {
  id: string;
  source: string;
  status: string;
  email: string;
  name: string | null;
  empresa: string | null;
  createdAt: string;
  qualifiedAt: string | null;
  convertedAt: string | null;
  clientId: string | null;
  clientName: string | null;
  firstContentPath: string | null;
  landingPath: string | null;
}

export interface ClientOptionView {
  id: string;
  name: string;
}

const STATUS_LABEL: Record<string, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  qualified: "Calificado",
  lost: "Perdido",
};

const SOURCE_LABEL: Record<string, string> = {
  contact_form: "Contacto",
  newsletter: "Newsletter",
  diagnostic: "Diagnóstico",
};

const STATUS_TINT: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  contacted: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  qualified: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  lost: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export function LeadsTable({
  leads,
  clients,
}: {
  leads: LeadRowView[];
  clients: ClientOptionView[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  // Qué fila está en vuelo: sin esto, un fallo de red deja todos los selectores
  // deshabilitados y no se sabe cuál fue.
  const [busyId, setBusyId] = useState<string | null>(null);

  function run(leadId: string, action: () => Promise<{ ok: boolean; error?: string }>, okMessage: string) {
    setBusyId(leadId);
    startTransition(async () => {
      const result = await action();
      setBusyId(null);
      if (result.ok) {
        toast({ title: okMessage });
        router.refresh();
      } else {
        toast({
          title: "No se pudo guardar",
          description: result.error ?? "Inténtalo de nuevo.",
          variant: "destructive",
        });
      }
    });
  }

  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
        Todavía no hay leads. Aparecen aquí en cuanto alguien envía el formulario de contacto o
        termina el diagnóstico.
      </div>
    );
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="px-3 py-2 text-left font-medium">Lead</th>
            <th scope="col" className="px-3 py-2 text-left font-medium">Origen</th>
            <th scope="col" className="px-3 py-2 text-left font-medium">Contenido de entrada</th>
            <th scope="col" className="px-3 py-2 text-left font-medium">Estado</th>
            <th scope="col" className="px-3 py-2 text-left font-medium">Cliente</th>
            <th scope="col" className="px-3 py-2 text-left font-medium">Fechas</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const busy = pending && busyId === lead.id;
            return (
              <tr key={lead.id} className="border-t border-border align-top">
                <td className="px-3 py-3">
                  <p className="font-medium text-foreground">{lead.name || "Sin nombre"}</p>
                  <p className="text-xs text-muted-foreground">{lead.email}</p>
                  {lead.empresa && <p className="text-xs text-muted-foreground">{lead.empresa}</p>}
                </td>

                <td className="px-3 py-3 text-xs text-muted-foreground">
                  {SOURCE_LABEL[lead.source] ?? lead.source}
                </td>

                <td className="px-3 py-3 text-xs">
                  {lead.firstContentPath ? (
                    <Link
                      href={lead.firstContentPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {lead.firstContentPath}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">
                      {/* Sin atribución NO se inventa un origen. */}
                      Sin atribuir
                    </span>
                  )}
                  {lead.landingPath && lead.landingPath !== lead.firstContentPath && (
                    <p className="mt-0.5 text-muted-foreground">Entró por {lead.landingPath}</p>
                  )}
                </td>

                <td className="px-3 py-3">
                  <label className="sr-only" htmlFor={`status-${lead.id}`}>
                    Estado del lead
                  </label>
                  <select
                    id={`status-${lead.id}`}
                    value={lead.status}
                    disabled={busy}
                    onChange={(e) =>
                      run(lead.id, () => setLeadStatusAction(lead.id, e.target.value), "Estado actualizado")
                    }
                    className={`rounded-md border border-border bg-background px-2 py-1 text-xs ${STATUS_TINT[lead.status] ?? ""}`}
                  >
                    {Object.entries(STATUS_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="px-3 py-3">
                  <label className="sr-only" htmlFor={`client-${lead.id}`}>
                    Cliente vinculado
                  </label>
                  <select
                    id={`client-${lead.id}`}
                    value={lead.clientId ?? ""}
                    disabled={busy}
                    onChange={(e) =>
                      run(
                        lead.id,
                        () => linkLeadToClientAction(lead.id, e.target.value || null),
                        e.target.value ? "Lead vinculado al cliente" : "Vínculo retirado"
                      )
                    }
                    className="max-w-[200px] rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                  >
                    <option value="">Sin vincular</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                  {lead.clientId && (
                    <Link
                      href={`/clientes/${lead.clientId}`}
                      className="mt-1 block text-xs text-primary hover:underline"
                    >
                      Abrir cuenta
                    </Link>
                  )}
                </td>

                <td className="px-3 py-3 text-xs text-muted-foreground">
                  <p>Llegó: {formatDate(lead.createdAt)}</p>
                  <p>Calificado: {formatDate(lead.qualifiedAt)}</p>
                  {/* Derivado de la primera venta del cliente vinculado — nunca manual. */}
                  <p>Convertido: {formatDate(lead.convertedAt)}</p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
