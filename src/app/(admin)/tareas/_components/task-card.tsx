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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Star } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
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

  // A11y: label compuesto que describe la tarea + estado + acción
  const statusLabel   = status?.label ?? task.status;
  const categoryLabel = category?.label ?? task.category;
  const ariaLabel     = `Tarea: ${task.title}. ${timeMX}. Categoría: ${categoryLabel}. Estado: ${statusLabel}. Pulsa Enter para ver opciones.`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={ariaLabel}
            className="w-full text-left appearance-none bg-transparent border-0 font-inherit
                       rounded-md p-2 cursor-pointer select-none bg-white/[0.03] hover:bg-white/[0.06]
                       transition-colors
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                       focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
            style={{ borderLeft: `2px solid ${category?.color ?? '#71717a'}` }}
          >
            <p className="text-[10px] text-zinc-500 leading-none mb-1">{timeMX}</p>

            <div className="flex items-start gap-1">
              {task.important && !isCompleted && !isCancelled && (
                <Star className="mt-px h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
              )}
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
            </div>

            {isInProgress && (
              <div className="flex items-center gap-1 mt-1">
                <Spinner size="sm" className="text-amber-400" />
                <span className="text-[10px] text-amber-400">En progreso</span>
              </div>
            )}
          </button>
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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem
                className="text-red-400 focus:text-red-300"
                onSelect={(e) => e.preventDefault()}
              >
                Eliminar
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
                <AlertDialogDescription className="text-zinc-400">
                  Esta acción no se puede deshacer. La tarea &ldquo;{task.title}&rdquo; se eliminará permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-zinc-700 text-zinc-300">
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={handleDelete}
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
