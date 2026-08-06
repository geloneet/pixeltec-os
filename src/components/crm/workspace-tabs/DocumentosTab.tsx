"use client";

/**
 * Expediente documental del cliente (ADR-0034): la vista del jsonb
 * `clients.documents`, que hasta ahora no tenía UI en el workspace. v1 es
 * solo lectura — la carga de archivos requiere infra de upload propia y
 * queda fuera de este gate. (La facturación, que antes usurpaba el label
 * "Documentos", vive ahora en Comercial → Facturación.)
 */
import { useEffect, useState } from "react";
import { FileText, ExternalLink } from "lucide-react";
import { getClientDocumentsAction, type ClientDocumentEntry } from "../crm-actions";

export function DocumentosTab({ clientId }: { clientId: string }) {
  const [docs, setDocs] = useState<ClientDocumentEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getClientDocumentsAction(clientId).then((d) => {
      if (!cancelled) setDocs(d);
    });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (docs === null) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Cargando expediente…</p>;
  }

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FileText className="mb-3 h-8 w-8 text-muted-foreground/50" aria-hidden />
        <p className="text-sm font-medium text-foreground mb-1">Expediente vacío</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Aquí vivirán los documentos generales del cliente (identificaciones, acuerdos,
          material de referencia). Las propuestas, contratos y facturas tienen su propio
          lugar en la pestaña Comercial.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {docs.map((d) => (
        <li key={`${d.url}|${d.name}`}>
          <a
            href={d.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-secondary/40"
          >
            <span className="flex items-center gap-2 font-medium text-foreground">
              <FileText className="h-4 w-4 text-cyan-400" aria-hidden />
              {d.name}
            </span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {d.uploadedAt ? d.uploadedAt.slice(0, 10) : null}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
