"use client";

import { useState } from "react";
import { Download, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { SealedStationView } from "@/components/definition/SealedStationView";
import { CreateProposalButton } from "@/components/definition/CreateProposalButton";
import { DELIVERABLE_META, getStationMeta } from "@/lib/definition/station-meta";
import type { DefinitionStation } from "@/lib/definition/types";
import type { DefinitionViewModel } from "@/components/definition/view-model";

interface Props {
  data: DefinitionViewModel;
  onReopen: (station: DefinitionStation, reason: string) => Promise<void>;
}

/**
 * Pantalla de resumen final: los 3 documentos sellados con descarga en
 * Markdown, más la conversión opcional a proyecto CRM. Los insumos de la
 * siguiente fase (que aún no arranca).
 */
export function DefinitionSummary({ data, onReopen }: Props) {
  const [showAll, setShowAll] = useState(false);

  const deliverables = DELIVERABLE_META.map((meta) => {
    const row = data.stations.find((s) => s.station === meta.id);
    return { meta, row };
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/30 p-5">
        <h2 className="mb-1 text-sm font-semibold text-zinc-100">
          Proceso completo
        </h2>
        <p className="mb-4 text-xs text-zinc-500">
          Descarga los 3 documentos — son el insumo de la siguiente fase.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          {deliverables.map(({ meta, row }) => (
            <div
              key={meta.id}
              className="flex flex-col gap-2 rounded-lg border border-white/[0.06] bg-zinc-950/40 p-4"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-cyan-400" />
                <span className="text-sm font-medium text-zinc-100">
                  {meta.sealName}
                </span>
              </div>
              {row?.sealedByName && (
                <p className="text-[11px] text-zinc-600">
                  Sellado por {row.sealedByName}
                </p>
              )}
              <a
                href={`/api/definition/${data.id}/export?doc=${meta.exportSlug}`}
                download
                className="mt-1 flex items-center justify-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-zinc-100"
              >
                <Download className="h-3.5 w-3.5" />
                Descargar .md
              </a>
            </div>
          ))}
        </div>

        <div className="mt-5 border-t border-white/[0.06] pt-4">
          <CreateProposalButton definitionId={data.id} proposalId={data.proposalId} />
          {data.proposalId && (
            <p className="mt-2 text-[11px] text-zinc-600">
              Si reabres una estación después de generar la propuesta, esta no
              se revierte — solo se avisará que los documentos cambiaron.
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowAll((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300"
      >
        {showAll ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        Ver los 4 documentos completos
      </button>

      {showAll && (
        <div className="space-y-4">
          {data.stations.map((s) => {
            const meta = getStationMeta(s.station);
            if (s.status !== "sealed" || !s.sealedContent) return null;
            return (
              <SealedStationView
                key={s.station}
                station={s.station}
                title={meta.title}
                sealName={meta.sealName}
                content={s.sealedContent}
                sealedAtLabel={
                  s.sealedAt
                    ? new Date(s.sealedAt).toLocaleDateString("es-MX", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : null
                }
                sealedByName={s.sealedByName}
                hasDownstream={s.station !== "flujo"}
                onReopen={(reason) => onReopen(s.station, reason)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
