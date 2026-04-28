'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Loader2 } from 'lucide-react';
import { CATEGORIES, STATUSES } from '@/lib/assistant/constants';
import { formatTimeMX } from '@/lib/assistant/week-helpers';
import { setTaskStatus, deleteTask } from '@/lib/assistant/actions/tasks';
import type { AssistantTaskSerialized } from '@/lib/assistant/types';
import { PostponeDialog } from './postpone-dialog';

interface Props {
  task: AssistantTaskSerialized;
  onStatusChange: (taskId: string, status: AssistantTaskSerialized['status']) => void;
  onDelete: (taskId: string) => void;
  onEdit: (task: AssistantTaskSerialized) => void;
}

export function TaskCard({ task, onStatusChange, onDelete, onEdit }: Props) {
  const [postponeOpen, setPostponeOpen] = useState(false);

  const category = CATEGORIES.find((c) => c.value === task.category);
  const status   = STATUSES.find((s) => s.value === task.status);

  const isCompleted  = task.status === 'completed';
  const isCancelled  = task.status === 'cancelled';
  const isInProgress = task.status === 'in_progress';

  async function handleSetStatus(newStatus: AssistantTaskSerialized['status']) {
    const result = await setTaskStatus(task.id, newStatus);
    if (result.ok) {
      onStatusChange(task.id, newStatus);
    } else {
      toast.error(result.error ?? 'Error al actualizar estado');
    }
  }

  async function handleDelete() {
    const result = await deleteTask(task.id);
    if (result.ok) {
      onDelete(task.id);
      toast.success('Tarea eliminada');
    } else {
      toast.error(result.error ?? 'Error al eliminar');
    }
  }

  const timeMX = formatTimeMX(new Date(task.startsAt));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div
            className="rounded-md p-2 cursor-pointer select-none bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
            style={{ borderLeft: `2px solid ${category?.color ?? '#71717a'}` }}
          >
            <p className="text-[10px] text-zinc-500 leading-none mb-1">{timeMX}</p>

            <p
              className="text-[12px] font-medium leading-tight"
              style={{
                color:          isCompleted || isCancelled ? '#71717a' : '#e4e4e7',
                textDecoration: isCompleted || isCancelled ? 'line-through' : 'none',
                opacity:        isCancelled ? 0.5 : isCompleted ? 0.6 : 1,
              }}
            >
              {task.title}
            </p>

            {isInProgress && (
              <div className="flex items-center gap-1 mt-1">
                <Loader2 className="w-2.5 h-2.5 text-amber-400 animate-spin" />
                <span className="text-[10px] text-amber-400">En progreso</span>
              </div>
            )}
          </div>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          className="bg-zinc-900 border-zinc-700 text-zinc-100"
          align="start"
          side="right"
        >
          <DropdownMenuItem onClick={() => handleSetStatus('in_progress')}>
            Marcar en progreso
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSetStatus('completed')}>
            Marcar completada
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSetStatus('cancelled')}>
            Cancelar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPostponeOpen(true)}>
            Posponer…
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-zinc-700" />
          <DropdownMenuItem onClick={() => onEdit(task)}>
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-red-400 focus:text-red-300"
            onClick={handleDelete}
          >
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PostponeDialog
        taskId={task.id}
        open={postponeOpen}
        onClose={() => setPostponeOpen(false)}
        onPostponed={() => {
          onStatusChange(task.id, 'pending');
          setPostponeOpen(false);
        }}
      />
    </>
  );
}
