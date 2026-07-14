"use client";

import { useState, useCallback } from "react";
import { useUser } from "@/hooks/use-user";
import { useUserProfile } from "@/hooks/use-user-profile";
import { cn } from "@/lib/utils";
import {
  CRMProject,
  ProjectLogEntry,
  ProjectLogCategory,
  PROJECT_LOG_CATEGORIES,
} from "@/types/crm";

const MAX_VISIBLE = 5;
const MAX_PREVIEW = 300;

const CATEGORY_COLORS: Record<ProjectLogCategory, string> = {
  General:         "bg-muted text-muted-foreground border border-border",
  Cliente:         "bg-cyan-500/15 text-cyan-400 border border-cyan-500/20",
  Desarrollo:      "bg-purple-500/15 text-purple-400 border border-purple-500/20",
  Infraestructura: "bg-amber-500/15 text-amber-400 border border-amber-500/20",
  Cobros:          "bg-green-500/15 text-green-400 border border-green-500/20",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "hace un momento";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ayer";
  if (d < 7) return `hace ${d} días`;
  const w = Math.floor(d / 7);
  if (w < 5) return `hace ${w} semanas`;
  const mo = Math.floor(d / 30);
  return `hace ${mo} meses`;
}

interface Props {
  project: CRMProject;
  clientId: string;
  onAddEntry: (entry: Omit<ProjectLogEntry, "id">) => void;
}

export function ProjectBitacora({ project, onAddEntry }: Props) {
  const user = useUser();
  const { userProfile } = useUserProfile();

  const [category, setCategory] = useState<ProjectLogCategory>("General");
  const [content, setContent] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const notesLog = project.notesLog ?? [];
  const visible = notesLog.slice(0, MAX_VISIBLE);

  const handleSubmit = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const authorName =
      userProfile?.displayName ||
      user?.displayName ||
      user?.email ||
      "Usuario";
    onAddEntry({
      category,
      content: trimmed,
      authorName,
      createdAt: new Date().toISOString(),
    });
    setContent("");
    setCategory("General");
  }, [content, category, onAddEntry, userProfile, user]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const headerSub =
    notesLog.length === 0
      ? null
      : notesLog.length === 1
      ? "1 registro"
      : `${notesLog.length} registros`;

  return (
    <div>
      {/* Header */}
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className="text-sm font-semibold text-foreground">Bitácora del proyecto</h3>
        {headerSub && (
          <span className="text-[11px] text-muted-foreground/60">{headerSub}</span>
        )}
      </div>

      {/* Capture form */}
      <div className="mb-4 rounded-xl border border-border bg-card p-4 space-y-3">
        {/* Category selector */}
        <div className="flex flex-wrap gap-1.5">
          {PROJECT_LOG_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                category === cat
                  ? CATEGORY_COLORS[cat]
                  : "bg-secondary/40 text-muted-foreground hover:text-foreground"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Escribe una actualización relevante del proyecto…"
          rows={3}
          className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-[#0EA5E9]/40 focus:outline-none transition-colors"
        />

        {/* Submit */}
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!content.trim()}
            className="px-4 py-1.5 text-sm bg-[#0EA5E9] text-white rounded-lg hover:bg-[#0284C7] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
          >
            Agregar nota
          </button>
        </div>
      </div>

      {/* Note list */}
      {visible.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted-foreground/60">
          No existen registros en la bitácora. Utiliza el formulario superior para
          registrar la primera actualización del proyecto.
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map(entry => {
            const isExpanded = expanded.has(entry.id);
            const needsTruncation = entry.content.length > MAX_PREVIEW;
            const displayContent =
              needsTruncation && !isExpanded
                ? entry.content.slice(0, MAX_PREVIEW) + "…"
                : entry.content;

            return (
              <div
                key={entry.id}
                className="rounded-xl border border-border bg-card px-4 py-3 space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      CATEGORY_COLORS[entry.category]
                    )}
                  >
                    {entry.category}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {entry.authorName} · {relativeTime(entry.createdAt)}
                </p>
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                  {displayContent}
                  {needsTruncation && (
                    <button
                      onClick={() => toggleExpand(entry.id)}
                      className="ml-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isExpanded ? "ver menos" : "ver más"}
                    </button>
                  )}
                </p>
              </div>
            );
          })}

          {notesLog.length > MAX_VISIBLE && (
            <button
              // stub — full history view not yet implemented
              onClick={() => {}}
              className="mt-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Ver historial completo →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
