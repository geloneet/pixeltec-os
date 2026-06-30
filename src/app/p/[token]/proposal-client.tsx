"use client";

import { useEffect, useState } from "react";
import { Check, X, Download, ChevronDown, ChevronUp } from "lucide-react";
import type { Proposal } from "@/types/documents";

interface Props {
  proposal: Proposal;
  token: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

function parseDeliverables(raw: string): string[] {
  return raw
    .split("\n")
    .map(l => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

export function ProposalClient({ proposal, token }: Props) {
  const [action, setAction] = useState<"idle" | "confirming-accept" | "confirming-reject" | "loading" | "done-accept" | "done-reject" | "error">("idle");
  const [showVersions, setShowVersions] = useState(false);

  // Track view on mount
  useEffect(() => {
    fetch("/api/proposals/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => {});
  }, [token]);

  const handleAction = async (act: "aceptada" | "rechazada") => {
    setAction("loading");
    try {
      const res = await fetch("/api/proposals/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: act }),
      });
      if (res.ok) {
        setAction(act === "aceptada" ? "done-accept" : "done-reject");
      } else {
        const { error } = await res.json() as { error?: string };
        if (error === "already_decided") {
          setAction(act === "aceptada" ? "done-accept" : "done-reject");
        } else {
          setAction("error");
        }
      }
    } catch {
      setAction("error");
    }
  };

  const alreadyAccepted = proposal.status === "aceptada";
  const alreadyRejected = proposal.status === "rechazada";
  const hasDecision = alreadyAccepted || alreadyRejected || action === "done-accept" || action === "done-reject";
  const isAccepted = alreadyAccepted || action === "done-accept";

  const items = proposal.deliverables ? parseDeliverables(proposal.deliverables) : [];

  return (
    <div className="bg-white min-h-screen" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <header style={{ background: "#0D1426" }} className="px-8 py-5 flex items-center justify-between">
        <div>
          <div className="text-white font-bold text-lg tracking-widest">PIXELTEC</div>
          <div style={{ color: "#8899cc" }} className="text-xs mt-0.5">Propuesta Comercial</div>
        </div>
        <a
          href={`/api/documents/proposal-pdf?token=${token}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all"
          style={{ borderColor: "#2a3a6a", color: "#8899cc" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "white"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#8899cc"; }}
        >
          <Download className="h-3.5 w-3.5" />
          Descargar PDF
        </a>
      </header>

      {/* Body */}
      <main className="max-w-2xl mx-auto px-8 py-12">

        {/* Reference + version */}
        <div className="flex items-center gap-3 mb-4">
          {proposal.reference && (
            <span className="text-xs font-mono font-semibold px-2 py-1 rounded" style={{ background: "#EEF2FF", color: "#3B5BDB" }}>
              {proposal.reference}
            </span>
          )}
          <span className="text-xs" style={{ color: "#94a3b8" }}>
            Versión {proposal.currentVersion ?? 1}
          </span>
          {(proposal.versions?.length ?? 0) > 1 && (
            <button
              onClick={() => setShowVersions(v => !v)}
              className="flex items-center gap-1 text-xs"
              style={{ color: "#3B5BDB" }}
            >
              {showVersions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {proposal.versions!.length} versiones
            </button>
          )}
        </div>

        {/* Version history */}
        {showVersions && proposal.versions && (
          <div className="mb-6 rounded-xl border p-4" style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}>
            <p className="text-xs font-semibold mb-3" style={{ color: "#64748b" }}>Historial de versiones</p>
            <div className="space-y-2">
              {[...proposal.versions].reverse().map(v => (
                <div key={v.version} className="flex items-center gap-3 text-sm">
                  <span className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded" style={{ background: "#e2e8f0", color: "#475569" }}>
                    v{v.version}
                  </span>
                  <span style={{ color: "#334155" }}>{v.title}</span>
                  <span className="ml-auto text-xs" style={{ color: "#94a3b8" }}>
                    {formatDate(v.savedAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Title */}
        <h1 className="text-3xl font-bold mb-2" style={{ color: "#0f172a", lineHeight: 1.25 }}>
          {proposal.title}
        </h1>

        {/* Meta row */}
        <div className="grid grid-cols-3 gap-4 mt-6 mb-8 py-5 border-t border-b" style={{ borderColor: "#e2e8f0" }}>
          <MetaCell label="Cliente" value={proposal.clientName} />
          <MetaCell label="Fecha" value={formatDate(proposal.createdAt)} />
          <MetaCell label="Referencia" value={proposal.reference ?? "—"} />
        </div>

        {/* Sections */}
        <Section label="Resumen ejecutivo">
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#334155" }}>
            {proposal.scope}
          </p>
        </Section>

        {proposal.solution && (
          <Section label="Solución propuesta">
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#334155" }}>
              {proposal.solution}
            </p>
          </Section>
        )}

        {items.length > 0 && (
          <Section label="Entregables">
            <ul className="space-y-1.5">
              {items.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: "#334155" }}>
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: "#3B5BDB" }} />
                  {item}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {proposal.benefits && (
          <Section label="Beneficios">
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#334155" }}>
              {proposal.benefits}
            </p>
          </Section>
        )}

        {/* Investment */}
        {(proposal.budget || proposal.timeline) && (
          <div className="grid grid-cols-2 gap-4 my-8">
            {proposal.budget && (
              <InvestBox label="Inversión" value={proposal.budget} />
            )}
            {proposal.timeline && (
              <InvestBox label="Tiempo estimado" value={proposal.timeline} />
            )}
          </div>
        )}

        {/* Divider */}
        <div className="border-t my-8" style={{ borderColor: "#e2e8f0" }} />

        {/* Action area */}
        {hasDecision ? (
          <div className={`rounded-xl p-5 flex items-center gap-3 ${isAccepted ? "" : ""}`}
            style={{ background: isAccepted ? "#f0fdf4" : "#fff1f2", border: `1px solid ${isAccepted ? "#bbf7d0" : "#fecdd3"}` }}
          >
            {isAccepted ? (
              <>
                <div className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#dcfce7" }}>
                  <Check className="h-5 w-5" style={{ color: "#15803d" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#15803d" }}>Propuesta aceptada</p>
                  {proposal.acceptedAt && (
                    <p className="text-xs mt-0.5" style={{ color: "#4ade80" }}>
                      {formatDate(proposal.acceptedAt)}
                    </p>
                  )}
                  <p className="text-xs mt-1" style={{ color: "#16a34a" }}>
                    Nos pondremos en contacto pronto para los siguientes pasos.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#fee2e2" }}>
                  <X className="h-5 w-5" style={{ color: "#dc2626" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#dc2626" }}>Propuesta no aceptada</p>
                  <p className="text-xs mt-1" style={{ color: "#b91c1c" }}>
                    Gracias por tu tiempo. Puedes contactarnos si deseas ajustar algún aspecto.
                  </p>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-semibold" style={{ color: "#0f172a" }}>¿Qué te parece esta propuesta?</p>
            <p className="text-xs" style={{ color: "#64748b" }}>
              Puedes aceptarla directamente desde aquí o comunicarte con nosotros para ajustes.
            </p>
            <div className="flex gap-3 mt-4">
              {action === "confirming-accept" ? (
                <>
                  <button
                    onClick={() => handleAction("aceptada")}
                    className="flex-1 rounded-xl py-3 text-sm font-semibold transition-all"
                    style={{ background: "#15803d", color: "white" }}
                  >
                    Confirmar aceptación
                  </button>
                  <button
                    onClick={() => setAction("idle")}
                    className="rounded-xl border px-4 py-3 text-sm font-medium"
                    style={{ borderColor: "#e2e8f0", color: "#64748b" }}
                  >
                    Cancelar
                  </button>
                </>
              ) : action === "confirming-reject" ? (
                <>
                  <button
                    onClick={() => handleAction("rechazada")}
                    className="flex-1 rounded-xl py-3 text-sm font-semibold transition-all"
                    style={{ background: "#dc2626", color: "white" }}
                  >
                    Confirmar rechazo
                  </button>
                  <button
                    onClick={() => setAction("idle")}
                    className="rounded-xl border px-4 py-3 text-sm font-medium"
                    style={{ borderColor: "#e2e8f0", color: "#64748b" }}
                  >
                    Cancelar
                  </button>
                </>
              ) : action === "loading" ? (
                <div className="flex items-center gap-2 text-sm" style={{ color: "#64748b" }}>
                  <div className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#3B5BDB", borderTopColor: "transparent" }} />
                  Procesando...
                </div>
              ) : action === "error" ? (
                <p className="text-sm" style={{ color: "#dc2626" }}>
                  Ocurrió un error. Por favor, contáctanos directamente.
                </p>
              ) : (
                <>
                  <button
                    onClick={() => setAction("confirming-accept")}
                    className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all"
                    style={{ background: "#15803d", color: "white" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#166534"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#15803d"; }}
                  >
                    <Check className="h-4 w-4" />
                    Aceptar propuesta
                  </button>
                  <button
                    onClick={() => setAction("confirming-reject")}
                    className="rounded-xl border px-6 py-3 text-sm font-medium transition-all"
                    style={{ borderColor: "#e2e8f0", color: "#64748b" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#dc2626"; (e.currentTarget as HTMLElement).style.borderColor = "#fecaca"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#64748b"; (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0"; }}
                  >
                    No por ahora
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Closing */}
        <div className="mt-12 pt-8 border-t" style={{ borderColor: "#e2e8f0" }}>
          <p className="text-sm font-semibold" style={{ color: "#0f172a" }}>
            Gracias por confiar en nosotros.
          </p>
          <p className="text-xs mt-1.5" style={{ color: "#94a3b8" }}>
            PixelTEC · contacto@pixeltec.mx · pixeltec.mx
          </p>
        </div>
      </main>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <p className="text-[0.65rem] font-bold tracking-widest uppercase" style={{ color: "#3B5BDB" }}>
          {label}
        </p>
        <div className="flex-1 border-t" style={{ borderColor: "#e2e8f0" }} />
      </div>
      {children}
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.65rem] font-semibold uppercase tracking-wider mb-1" style={{ color: "#94a3b8" }}>
        {label}
      </p>
      <p className="text-sm font-semibold" style={{ color: "#0f172a" }}>{value}</p>
    </div>
  );
}

function InvestBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-5" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
      <p className="text-[0.65rem] font-semibold uppercase tracking-wider mb-2" style={{ color: "#94a3b8" }}>
        {label}
      </p>
      <p className="text-xl font-bold" style={{ color: "#0f172a" }}>{value}</p>
    </div>
  );
}
