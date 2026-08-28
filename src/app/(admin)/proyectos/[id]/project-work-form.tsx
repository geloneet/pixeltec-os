"use client";

import { useState, useTransition } from "react";
import { updateProjectWork } from "@/lib/projects/actions";
import { PROJECT_STATUSES } from "@/lib/projects/constants";
import type { ProjectDetail } from "@/lib/projects/queries";
import { Button } from "@/components/ui/button";

export function ProjectWorkForm({ project }: { project: ProjectDetail }) {
  const [status, setStatus] = useState(project.status);
  const [progressPercent, setProgressPercent] = useState(project.progressPercent);
  const [observaciones, setObservaciones] = useState(project.observaciones);
  const [recursos, setRecursos] = useState(project.recursos);
  const [quickNotes, setQuickNotes] = useState(project.quickNotes);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateProjectWork(project.id, { status, progressPercent, observaciones, recursos, quickNotes });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(res.error ?? "No se pudo guardar.");
      }
    });
  }

  return (
    <div className="mt-6 space-y-6 rounded-xl border border-border bg-card p-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Estatus</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Avance — {progressPercent}%
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={progressPercent}
            onChange={(e) => setProgressPercent(Number(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Observaciones</label>
        <textarea
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          rows={3}
          placeholder="Qué está pasando con este proyecto ahora mismo..."
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Recursos</label>
        <textarea
          value={recursos}
          onChange={(e) => setRecursos(e.target.value)}
          rows={2}
          placeholder="Quién está trabajando, herramientas, accesos necesarios..."
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Notas</label>
        <textarea
          value={quickNotes}
          onChange={(e) => setQuickNotes(e.target.value)}
          rows={2}
          placeholder="Notas rápidas..."
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending}>
          {pending ? "Guardando..." : "Guardar"}
        </Button>
        {saved && <span className="text-sm text-emerald-500">Guardado ✓</span>}
      </div>
    </div>
  );
}
