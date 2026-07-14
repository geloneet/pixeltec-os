"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useUser } from "@/hooks/use-user";
import type { DiscoverySession } from "@/types/documents";
import { DISCOVERY_INDUSTRIES } from "@/types/documents";
import {
  getLatestDiscoverySession,
  createDiscoverySession,
  updateDiscoverySession,
} from "@/lib/documents/discovery";

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  clientId: string;
  clientName: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByCategory(questions: DiscoverySession["questions"]): Record<string, DiscoverySession["questions"]> {
  const groups: Record<string, DiscoverySession["questions"]> = {};
  for (const q of questions) {
    if (!groups[q.category]) groups[q.category] = [];
    groups[q.category].push(q);
  }
  return groups;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function DiscoveryTab({ clientId, clientName }: Props) {
  const user = useUser();

  // Data
  const [session, setSession] = useState<DiscoverySession | null>(null);
  const [loading, setLoading] = useState(true);

  // Generate form
  const [industry, setIndustry] = useState<string>("");
  const [generating, setGenerating] = useState(false);

  // Answer mode
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadSession = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await getLatestDiscoverySession(user.uid, clientId);
      setSession(data);
      if (data) setAnswers(data.answers);
    } finally {
      setLoading(false);
    }
  }, [user, clientId]);

  useEffect(() => { loadSession(); }, [loadSession]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!industry || !user) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/documents/discovery-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry, clientName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (!data.questions?.length) throw new Error("No questions returned");
      const id = await createDiscoverySession(user.uid, clientId, {
        industry,
        status: "en_progreso",
        questions: data.questions,
        answers: {},
        generatedAt: new Date().toISOString(),
      });
      setSession({
        id,
        uid: user.uid,
        clientId,
        industry,
        status: "en_progreso",
        questions: data.questions,
        answers: {},
        generatedAt: new Date().toISOString(),
      });
      setAnswers({});
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!session) return;
    setSaving(true);
    try {
      const isComplete = session.questions
        .filter((q) => q.required)
        .every((q) => answers[q.id]?.trim());
      await updateDiscoverySession(session.id, {
        answers,
        status: isComplete ? "completado" : "en_progreso",
        ...(isComplete ? { completedAt: new Date().toISOString() } : {}),
      });
      setSession((prev) =>
        prev
          ? { ...prev, answers, status: isComplete ? "completado" : "en_progreso" }
          : prev,
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="md" className="text-cyan-400" />
      </div>
    );
  }

  // ── No session / start view ───────────────────────────────────────────────────

  if (!session || (session.status === "en_progreso" && session.questions.length === 0)) {
    return (
      <div className="space-y-5">
        <h3 className="text-sm font-semibold text-foreground">Cuestionario de Descubrimiento</h3>

        {/* Industry selector */}
        <div>
          <p className="mb-3 text-xs font-medium text-muted-foreground">Selecciona la industria del cliente</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {DISCOVERY_INDUSTRIES.map((ind) => (
              <button
                key={ind}
                type="button"
                onClick={() => setIndustry(ind)}
                className={
                  industry === ind
                    ? "rounded-lg border border-cyan-500 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-400 transition-all"
                    : "rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:bg-secondary/40 hover:text-foreground"
                }
              >
                {ind}
              </button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!industry || generating}
          className="flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-300 transition-all hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generating ? (
            <Spinner size="sm" className="text-cyan-300" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {generating ? "Generando cuestionario..." : "Generar cuestionario con IA"}
        </button>
      </div>
    );
  }

  // ── In-progress view ──────────────────────────────────────────────────────────

  if (session.status === "en_progreso") {
    const grouped = groupByCategory(session.questions);

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Cuestionario de Discovery</h3>
            <span className="inline-flex items-center rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-400">
              {session.industry}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-all hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar respuestas"}
          </button>
        </div>

        {/* Questions grouped by category */}
        {Object.entries(grouped).map(([category, questions]) => (
          <div key={category} className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {category}
            </p>
            {questions.map((q) => (
              <div key={q.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                <label className="block text-xs font-medium text-foreground">
                  {q.text}
                  {q.required && <span className="ml-1 text-cyan-500">*</span>}
                </label>

                {q.type === "text" && (
                  <textarea
                    rows={3}
                    value={answers[q.id] ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                    }
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 resize-none"
                  />
                )}

                {q.type === "select" && q.options && (
                  <div className="space-y-1.5">
                    {q.options.map((option) => (
                      <label
                        key={option}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name={q.id}
                          value={option}
                          checked={answers[q.id] === option}
                          onChange={() =>
                            setAnswers((prev) => ({ ...prev, [q.id]: option }))
                          }
                          className="accent-cyan-500"
                        />
                        <span className="text-xs text-foreground">{option}</span>
                      </label>
                    ))}
                  </div>
                )}

                {q.type === "multiselect" && q.options && (
                  <div className="space-y-1.5">
                    {q.options.map((option) => {
                      const current = answers[q.id] ? answers[q.id].split(",") : [];
                      const checked = current.includes(option);
                      return (
                        <label
                          key={option}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setAnswers((prev) => {
                                const curr = prev[q.id] ? prev[q.id].split(",") : [];
                                const updated = curr.includes(option)
                                  ? curr.filter((v) => v !== option)
                                  : [...curr, option];
                                return { ...prev, [q.id]: updated.join(",") };
                              })
                            }
                            className="accent-cyan-500"
                          />
                          <span className="text-xs text-foreground">{option}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

        {/* Bottom save */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-300 transition-all hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar respuestas"}
        </button>
      </div>
    );
  }

  // ── Completed view ────────────────────────────────────────────────────────────

  if (session.status === "completado") {
    const grouped = groupByCategory(session.questions);

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground">Discovery completado</h3>
            <span className="inline-flex items-center rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-400">
              {session.industry}
            </span>
            {session.completedAt && (
              <span className="text-[10px] text-muted-foreground">
                {new Date(session.completedAt).toLocaleDateString("es-MX")}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setSession(null);
              setIndustry("");
              setAnswers({});
            }}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:bg-secondary/40 hover:text-foreground"
          >
            Nueva sesión
          </button>
        </div>

        {/* Read-only questions + answers */}
        {Object.entries(grouped).map(([category, questions]) => (
          <div key={category} className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {category}
            </p>
            {questions.map((q) => (
              <div key={q.id} className="rounded-xl border border-border bg-card p-4 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">{q.text}</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {session.answers[q.id]
                    ? q.type === "multiselect"
                      ? session.answers[q.id].split(",").join(", ")
                      : session.answers[q.id]
                    : <span className="text-muted-foreground italic">Sin respuesta</span>}
                </p>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return null;
}
