"use client";
import type { Contract } from "@/types/documents";

interface Props {
  contracts: Contract[];
  token: string;
}

export default function PortalDocumentos({ contracts, token }: Props) {
  return (
    <div className="space-y-6">
      {/* Contratos firmados */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Contratos firmados</h2>
        {contracts.length === 0 ? (
          <p className="text-zinc-400 text-sm">No hay contratos firmados disponibles.</p>
        ) : (
          <ul className="space-y-2">
            {contracts.map(contract => (
              <li
                key={contract.id}
                className="flex items-center justify-between rounded-lg bg-zinc-800/50 border border-zinc-700/50 px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{contract.title}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {new Date(contract.updatedAt).toLocaleDateString("es-MX", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-300 border border-green-500/20 whitespace-nowrap">
                    Firmado · v{contract.version}
                  </span>
                </div>
                <a
                  href={`/api/documents/contract-pdf?contractId=${contract.id}&token=${token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-4 shrink-0 text-xs px-3 py-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors"
                >
                  Descargar
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Facturas — placeholder */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Facturas</h2>
        <p className="text-zinc-400 text-sm">Las facturas estarán disponibles próximamente.</p>
      </div>
    </div>
  );
}
