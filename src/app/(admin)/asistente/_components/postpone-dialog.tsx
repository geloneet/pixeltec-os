'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AssistantPostponeSchema, type AssistantPostponeInput } from '@/lib/assistant/schemas';
import { postponeTask } from '@/lib/assistant/actions/tasks';

interface Props {
  taskId: string;
  open: boolean;
  onClose: () => void;
  onPostponed: () => void;
}

export function PostponeDialog({ taskId, open, onClose, onPostponed }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AssistantPostponeInput>({ resolver: zodResolver(AssistantPostponeSchema) });

  async function onSubmit(data: AssistantPostponeInput) {
    const result = await postponeTask(taskId, data);
    if (result.ok) {
      toast.success('Tarea pospuesta');
      onPostponed();
    } else {
      toast.error(result.error ?? 'Error al posponer');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Posponer tarea</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="pp-date">Nueva fecha</Label>
            <Input
              id="pp-date"
              type="date"
              className="bg-zinc-800 border-zinc-600"
              {...register('date')}
            />
            {errors.date && (
              <p className="text-xs text-red-400">{errors.date.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="pp-time">Nueva hora</Label>
            <Input
              id="pp-time"
              type="time"
              className="bg-zinc-800 border-zinc-600"
              {...register('time')}
            />
            {errors.time && (
              <p className="text-xs text-red-400">{errors.time.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando…' : 'Posponer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
