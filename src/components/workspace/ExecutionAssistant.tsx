"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronRight, LoaderCircle, Copy, Check } from "lucide-react";
import type { WorkSession } from "@/types/session";
import type { CRMProject } from "@/types/crm";

interface Props {
  session: WorkSession;
  project: CRMProject;
  elapsed: number;
  onSaveAsObservation: (content: string) => void;
  onSaveToBitacora: (content: string) => void;
}

type PromptKey = "resumen" | "commit" | "siguiente" | "riesgos" | "bitacora" | "libre";
type HealthStatus = "healthy" | "attention" | "risk";

const PROMPT_LABELS: Record<PromptKey, string> = {
  resumen:   "Resume sesión",
  commit:    "Commit message",
  siguiente: "¿Qué sigue?",
  riesgos:   "Riesgos deploy",
  bitacora:  "Redacta bitácora",
  libre:     "Pregunta libre",
};

function computeHealthScore(session: WorkSession, elapsed: number): number {
  let score = 100;

  const activeBlockers = session.blockers.filter(b => b.status === "active");
  const waitingBlockers = session.blockers.filter(b => b.status === "waiting");
  const riskObs = session.notes.filter(n => (n.type === "riesgo" || n.type === "bug") && n.markedForSummary);
  const hasActiveActivity = session.activities.some(a => !a.completedAt);
  const completedGoals = (session.sessionGoals ?? []).filter(g => g.completed).length;
  const totalGoals = (session.sessionGoals ?? []).length;

  score -= activeBlockers.length * 20;
  score -= waitingBlockers.length * 8;
  score -= riskObs.length * 10;
  if (elapsed > 3600 && !hasActiveActivity) score -= 12;
  if (elapsed > 2700 && totalGoals > 0 && completedGoals === 0) score -= 8;

  return Math.max(0, Math.min(100, score));
}

function computeHealth(session: WorkSession, elapsed: number): HealthStatus {
  const score = computeHealthScore(session, elapsed);
  if (score < 60) return "risk";
  if (score < 80) return "attention";
  return "healthy";
}

const HEALTH_CONFIG: Record<HealthStatus, { label: string; dot: string; text: string }> = {
  healthy:   { label: "Saludable",         dot: "bg-green-400",  text: "text-green-400"  },
  attention: { label: "Atención requerida", dot: "bg-amber-400",  text: "text-amber-400"  },
  risk:      { label: "Riesgo de deploy",   dot: "bg-red-400",    text: "text-red-400"    },
};

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function CollapsibleSection({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-1.5 py-1.5 text-[0.65rem] font-medium uppercase tracking-wider text-zinc-600 hover:text-zinc-400 transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {title}
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}

function getCommands(tech: string): { cmd: string; desc: string }[] {
  const t = tech.toLowerCase();
  const cmds: { cmd: string; desc: string }[] = [];
  if (t.includes("next") || t.includes("react")) {
    cmds.push(
      { cmd: "npm run dev",   desc: "Inicia entorno local" },
      { cmd: "npm run build", desc: "Genera build producción" },
      { cmd: "npm run lint",  desc: "Revisa errores" },
    );
  }
  if (t.includes("docker")) {
    cmds.push(
      { cmd: "docker compose up",     desc: "Levanta servicios" },
      { cmd: "docker compose logs -f", desc: "Ve logs en vivo" },
    );
  }
  cmds.push(
    { cmd: "git status",               desc: "Ver cambios pendientes" },
    { cmd: "git add . && git commit",  desc: "Registrar cambios" },
  );
  return cmds;
}

const DEPLOY_CHECKLIST = [
  "Build local exitoso",
  "Validación mobile",
  "Consola limpia",
  "Variables de entorno revisadas",
  "Commit realizado",
];

export function ExecutionAssistant({ session, project, elapsed, onSaveAsObservation, onSaveToBitacora }: Props) {
  const health = computeHealth(session, elapsed);
  const score = computeHealthScore(session, elapsed);
  const hConf = HEALTH_CONFIG[health];
  const commands = getCommands(project.tech ?? "");

  const [deployChecks, setDeployChecks] = useState<Set<number>>(new Set());
  const toggleCheck = (i: number) => {
    setDeployChecks(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };

  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<{ key: PromptKey; label: string; ago: number } | null>(null);
  const [freeText, setFreeText] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedCmdIdx, setCopiedCmdIdx] = useState<number | null>(null);

  const runPrompt = useCallback(async (key: PromptKey, custom?: string) => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await fetch("/api/workspace/ai-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session, elapsed, promptKey: key, customPrompt: custom }),
      });
      const data = await res.json();
      setAiResult(data.text || "Sin respuesta.");
      setLastPrompt({ key, label: custom ?? PROMPT_LABELS[key], ago: Date.now() });
    } catch {
      setAiResult("Error al contactar el asistente.");
    } finally {
      setAiLoading(false);
    }
  }, [session, elapsed]);

  const handleCopy = () => {
    if (!aiResult) return;
    navigator.clipboard.writeText(aiResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleCopyCmd = (idx: number, cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmdIdx(idx);
    setTimeout(() => setCopiedCmdIdx(null), 1500);
  };

  const completedGoals = (session.sessionGoals ?? []).filter(g => g.completed).length;
  const totalGoals = (session.sessionGoals ?? []).length;
  const inProgressActivity = session.activities.find(a => !a.completedAt);

  return (
    <div className="flex flex-col gap-0 h-full overflow-y-auto pb-6">
      {/* Session health with numeric score */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04] ${hConf.text}`}>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${hConf.dot}`} />
          <span className="text-xs font-medium">{hConf.label}</span>
        </div>
        <span className="text-xs font-mono font-medium tabular-nums opacity-80">{score}</span>
      </div>

      <div className="px-4 py-3 space-y-0 divide-y divide-white/[0.04]">

        {/* Contexto */}
        <CollapsibleSection title="Contexto">
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600">Proyecto</span>
              <span className="text-zinc-300">{session.projectName}</span>
            </div>
            {project.tech && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-600">Stack</span>
                <span className="text-zinc-400 text-right max-w-[60%] truncate">{project.tech}</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600">Sesión</span>
              <span className="text-zinc-400">{formatElapsed(elapsed)}</span>
            </div>
            {totalGoals > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-600">Objetivos</span>
                <span className={completedGoals === totalGoals ? "text-green-400" : "text-zinc-400"}>
                  {completedGoals}/{totalGoals} completados
                </span>
              </div>
            )}
            {inProgressActivity && (
              <div className="flex justify-between text-xs gap-2">
                <span className="text-zinc-600 flex-shrink-0">Actividad</span>
                <span className="text-zinc-400 text-right truncate">{inProgressActivity.description}</span>
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Recordatorios */}
        <CollapsibleSection title="Recuerda" defaultOpen={false}>
          <ul className="space-y-1 pt-1">
            {[
              "Trabaja en localhost",
              "No modificar producción directamente",
              "Validar mobile antes de deploy",
              "Revisar consola de errores",
              "Revisar logs del servidor",
            ].map(tip => (
              <li key={tip} className="flex items-start gap-1.5 text-xs text-zinc-500">
                <span className="text-amber-500/60 flex-shrink-0">·</span>
                {tip}
              </li>
            ))}
          </ul>
        </CollapsibleSection>

        {/* Deploy checklist */}
        <CollapsibleSection title="Deploy checklist" defaultOpen={false}>
          <div className="space-y-1.5 pt-1">
            {DEPLOY_CHECKLIST.map((item, i) => (
              <button
                key={i}
                onClick={() => toggleCheck(i)}
                className="flex w-full items-center gap-2 text-left text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <span className={`h-3.5 w-3.5 flex-shrink-0 rounded border transition-all ${
                  deployChecks.has(i) ? "border-green-500 bg-green-500/20" : "border-zinc-700"
                }`}>
                  {deployChecks.has(i) && <span className="flex h-full items-center justify-center text-[9px] text-green-400">✓</span>}
                </span>
                <span className={deployChecks.has(i) ? "line-through text-zinc-600" : ""}>{item}</span>
              </button>
            ))}
          </div>
        </CollapsibleSection>

        {/* Comandos — snippet style */}
        <CollapsibleSection title="Comandos" defaultOpen={false}>
          <div className="space-y-2 pt-1">
            {commands.map((c, i) => (
              <div key={i} className="group rounded-lg bg-black/40 border border-white/[0.06] px-2.5 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[0.7rem] text-cyan-400 truncate">{c.cmd}</p>
                    <p className="text-[0.65rem] text-zinc-600 mt-0.5">{c.desc}</p>
                  </div>
                  <button
                    onClick={() => handleCopyCmd(i, c.cmd)}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.6rem] border border-white/[0.06] text-zinc-600 hover:text-zinc-300 hover:border-zinc-600 transition-all flex-shrink-0 mt-0.5"
                  >
                    {copiedCmdIdx === i
                      ? <><Check className="h-2.5 w-2.5 text-green-400" /> Copiado</>
                      : <><Copy className="h-2.5 w-2.5" /> Copiar</>
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* IA */}
        <CollapsibleSection title="Asistente IA">
          <div className="pt-2 space-y-3">
            {/* Prompt buttons */}
            <div className="flex flex-wrap gap-1.5">
              {(["resumen", "commit", "siguiente", "riesgos", "bitacora"] as PromptKey[]).map(key => (
                <button
                  key={key}
                  onClick={() => runPrompt(key)}
                  disabled={aiLoading}
                  className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-2.5 py-1 text-[0.65rem] text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-all disabled:opacity-40"
                >
                  {PROMPT_LABELS[key]}
                </button>
              ))}
            </div>

            {/* Free input */}
            <div className="flex gap-1.5">
              <input
                type="text"
                value={freeText}
                onChange={e => setFreeText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); runPrompt("libre", freeText); setFreeText(""); }}}
                placeholder="Pregunta libre..."
                className="flex-1 rounded-lg border border-white/[0.06] bg-zinc-900/40 px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/30 focus:outline-none transition-colors"
              />
              <button
                onClick={() => { runPrompt("libre", freeText); setFreeText(""); }}
                disabled={!freeText.trim() || aiLoading}
                className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-200 transition-all disabled:opacity-40"
              >
                ↵
              </button>
            </div>

            {/* Loading */}
            {aiLoading && (
              <div className="flex items-center gap-2 py-2">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                <span className="text-xs text-zinc-600">Consultando asistente...</span>
              </div>
            )}

            {/* Result */}
            {aiResult && !aiLoading && (
              <div className="rounded-lg border border-white/[0.06] bg-zinc-900/30 p-3 space-y-2">
                <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">{aiResult}</p>
                <div className="flex gap-1.5 flex-wrap border-t border-white/[0.04] pt-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-[0.65rem] border border-white/[0.06] text-zinc-500 hover:text-zinc-300 transition-all"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                  <button
                    onClick={() => onSaveAsObservation(aiResult)}
                    className="rounded px-2 py-0.5 text-[0.65rem] border border-white/[0.06] text-zinc-500 hover:text-zinc-300 transition-all"
                  >
                    Guardar como observación
                  </button>
                  <button
                    onClick={() => onSaveToBitacora(aiResult)}
                    className="rounded px-2 py-0.5 text-[0.65rem] border border-cyan-500/20 text-cyan-600 hover:text-cyan-400 transition-all"
                  >
                    Guardar en bitácora
                  </button>
                </div>
              </div>
            )}

            {/* Last query */}
            {lastPrompt && !aiLoading && (
              <div className="flex items-center justify-between text-[0.65rem] text-zinc-700 border-t border-white/[0.04] pt-2">
                <span>
                  Última: &ldquo;{lastPrompt.label.substring(0, 20)}&rdquo;
                  {" · "}
                  {Math.round((Date.now() - lastPrompt.ago) / 60000)} min
                </span>
                <button
                  onClick={() => runPrompt(lastPrompt.key)}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Repetir
                </button>
              </div>
            )}
          </div>
        </CollapsibleSection>

      </div>
    </div>
  );
}
