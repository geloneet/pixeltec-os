'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getCurrentWeekKey } from '@/lib/assistant/week-helpers';
import type { AssistantTemplateSerialized } from '@/lib/assistant/types';
import {
  generateTasksForCurrentWeek,
  toggleTemplateActive,
  deleteTemplate,
} from '@/lib/assistant/actions/templates';
import { TemplateCard } from './_components/template-card';

interface Props {
  templates: AssistantTemplateSerialized[];
}

export function TemplatesClient({ templates }: Props) {
  const [items, setItems] = useState<AssistantTemplateSerialized[]>(templates);
  const [isPending, startTransition] = useTransition();

  const weekNum = getCurrentWeekKey().split('-W')[1];

  async function handleGenerate() {
    startTransition(async () => {
      const result = await generateTasksForCurrentWeek();
      if (result.ok && result.data) {
        toast.success(
          `Creadas ${result.data.created} tareas. Saltadas ${result.data.skipped} (ya existían).`,
        );
      } else {
        toast.error(result.error ?? 'Error al generar tareas');
      }
    });
  }

  function handleToggleActive(id: string) {
    startTransition(async () => {
      const result = await toggleTemplateActive(id);
      if (result.ok) {
        setItems((prev) =>
          prev.map((t) => (t.id === id ? { ...t, active: !t.active } : t)),
        );
      } else {
        toast.error(result.error ?? 'Error al actualizar template');
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteTemplate(id);
      if (result.ok) {
        setItems((prev) => prev.filter((t) => t.id !== id));
      } else {
        toast.error(result.error ?? 'Error al eliminar template');
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Templates de actividades</h1>
          <p className="text-sm text-zinc-400">Actividades recurrentes configuradas</p>
        </div>
        <Button size="sm" asChild>
          <Link href="/asistente/templates/nuevo">+ Nuevo template</Link>
        </Button>
      </div>

      {/* Generate card */}
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-200">Generar tareas de esta semana</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Semana {weekNum} · Genera todas las tareas recurrentes según templates activos.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleGenerate}
          disabled={isPending}
        >
          {isPending ? 'Generando…' : 'Generar ahora'}
        </Button>
      </div>

      {/* Template list or empty state */}
      {items.length === 0 ? (
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-8 text-center">
          <p className="text-zinc-400 text-sm">Aún no has creado templates.</p>
          <p className="text-zinc-500 text-xs mt-1">Crea uno para automatizar tu rutina.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onToggleActive={handleToggleActive}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
