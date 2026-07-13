"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { Check, X, Download, ChevronDown, ChevronUp } from "lucide-react";
import { ObfuscatedMailto } from "@/components/ui/obfuscated-mailto";
import { Spinner } from "@/components/ui/spinner";
import type { Proposal } from "@/types/documents";

interface Props {
  proposal: Proposal;
  token: string;
}

const STATUS_LABEL: Record<Proposal["status"], string> = {
  borrador: "Borrador",
  enviada: "Pendiente de aprobación",
  vista: "Vista por el cliente",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
  vencida: "Vencida",
};

// Mismo boilerplate que el PDF (src/app/api/documents/proposal-pdf/route.tsx) —
// no depende de datos de la propuesta, es la metodología estándar de PixelTEC.
const PHASES = [
  { n: "01", label: "Discovery", desc: "Entendemos el problema real, el contexto del negocio y los objetivos detrás del proyecto." },
  { n: "02", label: "Diseño y arquitectura", desc: "Definimos la solución técnica y la experiencia antes de escribir una sola línea de código." },
  { n: "03", label: "Desarrollo", desc: "Construcción iterativa, con avances visibles en cada etapa del proceso." },
  { n: "04", label: "Validación", desc: "Pruebas, ajustes y revisión conjunta contigo antes del lanzamiento." },
  { n: "05", label: "Entrega y capacitación", desc: "Puesta en producción y acompañamiento para tu equipo." },
];

const TERMS: Array<{ label: string; value: string }> = [
  { label: "Anticipo", value: "Se requiere un anticipo para reservar el inicio del proyecto, conforme a lo acordado en el contrato de servicio." },
  { label: "Forma de pago", value: "Conforme a lo establecido en el contrato de servicio correspondiente a esta propuesta." },
  { label: "Vigencia de la propuesta", value: "Esta propuesta tiene una vigencia de 15 días naturales a partir de su fecha de emisión." },
  { label: "Qué no incluye", value: "Cualquier alcance, entregable o servicio no descrito explícitamente en esta propuesta." },
  { label: "Cambios fuera de alcance", value: "Cualquier solicitud adicional se evalúa y cotiza por separado antes de iniciar su desarrollo." },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

function parseBullets(raw: string): string[] {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const bulletLines = lines.filter((l) => /^[-•*]\s+/.test(l));
  if (bulletLines.length === 0) return [];
  return lines.map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
}

// Tema claro para bloques de propuesta que pueden traer markdown ("## título",
// listas) — la IA de Definición de Proyecto genera scope/solution así. Mismo
// patrón de react-markdown que KnowledgeMarkdown (CRM interno), pero con la
// paleta slate/blue de esta página pública en vez de la oscura del CRM.
const proposalMarkdownComponents: Components = {
  h1({ children }) {
    return <p className="mb-2 mt-4 text-sm font-bold text-slate-900 first:mt-0">{children}</p>;
  },
  h2({ children }) {
    return <p className="mb-2 mt-4 text-sm font-bold text-slate-900 first:mt-0">{children}</p>;
  },
  h3({ children }) {
    return <p className="mb-1.5 mt-3 text-sm font-semibold text-slate-800 first:mt-0">{children}</p>;
  },
  p({ children }) {
    return <p className="mb-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 last:mb-0">{children}</p>;
  },
  ul({ children }) {
    return <ul className="mb-2 ml-4 list-disc space-y-1 text-sm text-slate-700 marker:text-[#2196F3]">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="mb-2 ml-4 list-decimal space-y-1 text-sm text-slate-700">{children}</ol>;
  },
  strong({ children }) {
    return <strong className="font-semibold text-slate-900">{children}</strong>;
  },
};

function ProposalMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={proposalMarkdownComponents}>
      {content}
    </ReactMarkdown>
  );
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

  const deliverableItems = proposal.deliverables ? parseBullets(proposal.deliverables) : [];
  const benefitItems = proposal.benefits ? parseBullets(proposal.benefits) : [];
  const benefitParagraph = proposal.benefits && benefitItems.length === 0 ? proposal.benefits : null;

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Poppins, system-ui, -apple-system, sans-serif" }}>
      {/* ── Hero oscuro — misma identidad que la portada del PDF ────────────── */}
      <header className="relative overflow-hidden bg-[#0A0D14] px-6 pb-14 pt-8 sm:px-10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <svg className="absolute inset-0 h-full w-full opacity-70">
            <defs>
              <pattern id="pp-grid" width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(33,150,243,0.14)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#pp-grid)" />
          </svg>
          <div
            className="absolute -left-20 -top-20 h-[420px] w-[420px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(33,150,243,0.28) 0%, transparent 70%)", filter: "blur(50px)" }}
          />
        </div>

        <div className="relative z-10 mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Image src={process.env.NEXT_PUBLIC_LOGO_URL!} alt="" width={28} height={28} className="h-7 w-7" />
            <div>
              <div className="text-sm font-bold tracking-wide text-white">PixelTEC</div>
              <div className="text-[0.65rem] text-[#8B93A7]">Propuesta Comercial</div>
            </div>
          </div>
          <a
            href={`/api/documents/proposal-pdf?token=${token}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-[#25436B] px-3 py-1.5 text-xs font-medium text-[#8B93A7] transition-colors hover:border-[#2196F3]/60 hover:text-white"
          >
            <Download className="h-3.5 w-3.5" />
            Descargar PDF
          </a>
        </div>

        <div className="relative z-10 mx-auto mt-12 max-w-2xl">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {proposal.reference && (
              <span className="rounded-md bg-[#2196F3]/10 px-2 py-1 font-mono text-xs font-semibold text-[#7FC1FF]">
                {proposal.reference}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#25436B] bg-[#2196F3]/[0.06] px-2.5 py-1 text-[0.65rem] font-medium text-[#BFE0FF]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2196F3]" />
              {STATUS_LABEL[proposal.status]}
            </span>
            <span className="text-xs text-[#5B6478]">Versión {proposal.currentVersion ?? 1}</span>
            {(proposal.versions?.length ?? 0) > 1 && (
              <button
                onClick={() => setShowVersions((v) => !v)}
                className="flex items-center gap-1 text-xs text-[#7FC1FF] hover:text-white transition-colors"
              >
                {showVersions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {proposal.versions!.length} versiones
              </button>
            )}
          </div>

          <h1 className="text-3xl font-extrabold leading-tight text-white sm:text-[2.1rem]">
            {proposal.title}
          </h1>

          <div className="mt-8 grid grid-cols-3 gap-4">
            <HeroMeta label="Cliente" value={proposal.clientName} />
            <HeroMeta label="Fecha" value={formatDate(proposal.createdAt)} />
            <HeroMeta label="Referencia" value={proposal.reference ?? "—"} />
          </div>
        </div>
      </header>

      {/* ── Cuerpo — premium blanco, mismo acento que el PDF ────────────────── */}
      <main className="mx-auto max-w-2xl px-6 py-12 sm:px-10">

        {showVersions && proposal.versions && (
          <div className="mb-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-xs font-semibold text-slate-500">Historial de versiones</p>
            <div className="space-y-2">
              {[...proposal.versions].reverse().map((v) => (
                <div key={v.version} className="flex items-center gap-3 text-sm">
                  <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-600">
                    v{v.version}
                  </span>
                  <span className="text-slate-700">{v.title}</span>
                  <span className="ml-auto text-xs text-slate-400">{formatDate(v.savedAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Section label="Resumen ejecutivo">
          <ProposalMarkdown content={proposal.scope} />
        </Section>

        {proposal.solution && (
          <Section label="Solución propuesta">
            <ProposalMarkdown content={proposal.solution} />
          </Section>
        )}

        {deliverableItems.length > 0 && (
          <Section label="Alcance y entregables">
            <ul className="space-y-2">
              {deliverableItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#2196F3]" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {benefitItems.length > 0 && (
          <Section label="Beneficios">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {benefitItems.map((item, i) => (
                <div key={i} className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-[#2196F3]/10 text-[0.6rem] font-bold text-[#2196F3]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="text-[0.8rem] leading-snug text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </Section>
        )}
        {benefitParagraph && (
          <Section label="Beneficios">
            <ProposalMarkdown content={benefitParagraph} />
          </Section>
        )}

        {(proposal.budget || proposal.timeline) && (
          <div className="my-9 grid grid-cols-2 gap-3">
            {proposal.budget && <InvestCard label="Inversión" value={proposal.budget} />}
            {proposal.timeline && <InvestCard label="Tiempo estimado" value={proposal.timeline} />}
          </div>
        )}

        <Section label="Fases del proyecto">
          <div className="flex flex-col">
            {PHASES.map((phase, i) => (
              <div key={phase.n} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-[#2196F3] bg-white text-[0.65rem] font-bold text-[#2196F3]">
                    {phase.n}
                  </div>
                  {i < PHASES.length - 1 && <div className="mt-1 w-px flex-1 bg-slate-200" />}
                </div>
                <div className="pb-6">
                  <p className="text-sm font-bold text-slate-900">{phase.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{phase.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section label="Condiciones comerciales">
          <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            {TERMS.map((term) => (
              <div key={term.label} className="flex gap-3 text-xs">
                <span className="w-28 flex-shrink-0 font-bold text-slate-900">{term.label}</span>
                <span className="leading-relaxed text-slate-500">{term.value}</span>
              </div>
            ))}
          </div>
        </Section>

        <div className="my-9 border-t border-slate-200" />

        {/* Action area — misma lógica, sin cambios */}
        {hasDecision ? (
          <div
            className="flex items-center gap-3 rounded-xl p-5"
            style={{
              background: isAccepted ? "#f0fdf4" : "#fff1f2",
              border: `1px solid ${isAccepted ? "#bbf7d0" : "#fecdd3"}`,
            }}
          >
            {isAccepted ? (
              <>
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-green-100">
                  <Check className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-700">Propuesta aceptada</p>
                  {proposal.acceptedAt && (
                    <p className="mt-0.5 text-xs text-green-500">{formatDate(proposal.acceptedAt)}</p>
                  )}
                  <p className="mt-1 text-xs text-green-600">
                    Nos pondremos en contacto pronto para los siguientes pasos.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                  <X className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-600">Propuesta no aceptada</p>
                  <p className="mt-1 text-xs text-red-700">
                    Gracias por tu tiempo. Puedes contactarnos si deseas ajustar algún aspecto.
                  </p>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-900">¿Qué te parece esta propuesta?</p>
            <p className="text-xs text-slate-500">
              Puedes aceptarla directamente desde aquí o comunicarte con nosotros para ajustes.
            </p>
            <div className="mt-4 flex gap-3">
              {action === "confirming-accept" ? (
                <>
                  <button
                    onClick={() => handleAction("aceptada")}
                    className="flex-1 rounded-xl bg-green-700 py-3 text-sm font-semibold text-white transition-all hover:bg-green-800"
                  >
                    Confirmar aceptación
                  </button>
                  <button
                    onClick={() => setAction("idle")}
                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-500"
                  >
                    Cancelar
                  </button>
                </>
              ) : action === "confirming-reject" ? (
                <>
                  <button
                    onClick={() => handleAction("rechazada")}
                    className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white transition-all hover:bg-red-700"
                  >
                    Confirmar rechazo
                  </button>
                  <button
                    onClick={() => setAction("idle")}
                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-500"
                  >
                    Cancelar
                  </button>
                </>
              ) : action === "loading" ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Spinner size="sm" style={{ color: "#2196F3" }} />
                  Procesando...
                </div>
              ) : action === "error" ? (
                <p className="text-sm text-red-600">Ocurrió un error. Por favor, contáctanos directamente.</p>
              ) : (
                <>
                  <button
                    onClick={() => setAction("confirming-accept")}
                    className="flex items-center gap-2 rounded-xl bg-green-700 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-green-800"
                  >
                    <Check className="h-4 w-4" />
                    Aceptar propuesta
                  </button>
                  <button
                    onClick={() => setAction("confirming-reject")}
                    className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-medium text-slate-500 transition-all hover:border-red-200 hover:text-red-600"
                  >
                    No por ahora
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Cierre */}
        <div className="mt-14 flex flex-col items-center border-t border-slate-200 pt-8 text-center">
          <Image src={process.env.NEXT_PUBLIC_LOGO_URL!} alt="" width={24} height={24} className="mb-3 h-6 w-6" />
          <p className="text-sm font-bold text-slate-900">Gracias por confiar en nosotros.</p>
          <p className="mt-1 text-xs text-slate-500">Estamos listos para comenzar cuando tú lo estés.</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
            <ObfuscatedMailto email="contacto@pixeltec.mx" className="text-[#2196F3] hover:underline" />
            <span className="text-slate-300">·</span>
            <a href="https://pixeltec.mx" className="text-[#2196F3] hover:underline">pixeltec.mx</a>
            <span className="text-slate-300">·</span>
            <a href="https://api.whatsapp.com/send?phone=523221378336" className="text-[#2196F3] hover:underline">
              +52 322 137 8336
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-9">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="h-2.5 w-[3px] rounded-full bg-[#2196F3]" />
        <p className="text-[0.65rem] font-bold uppercase tracking-widest text-[#2196F3]">{label}</p>
      </div>
      {children}
    </div>
  );
}

function HeroMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-[0.6rem] font-bold uppercase tracking-wider text-[#5B6478]">{label}</p>
      <p className="text-[0.8rem] font-semibold text-white">{value}</p>
    </div>
  );
}

function InvestCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-[#0F172A] p-4">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-[#2196F3]" />
      <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-wider text-[#8B93A7]">{label}</p>
      <p className="text-lg font-extrabold text-white">{value}</p>
    </div>
  );
}
