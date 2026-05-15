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
import { Label } from '@/components/ui/label';
import { AssistantPostponeSchema, type AssistantPostponeInput } from '@/lib/assistant/schemas';
import { postponeTask } from '@/lib/assistant/actions/tasks';
import { DateTimePicker } from './date-time-picker';

interface Props {
  taskId: string;
  open: boolean;
  onClose: () => void;
  onPostponed: () => void;
}

export function PostponeDialog({ taskId, open, onClose, onPostponed }: Props) {
  const {
    setValue,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AssistantPostponeInput>({ resolver: zodResolver(AssistantPostponeSchema) });

  const dateValue = watch('date');
  const timeValue = watch('time');

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
            <Label>Nueva fecha y hora</Label>
            <DateTimePicker
              date={dateValue}
              time={timeValue}
              onChange={({ date, time }) => {
                if (date !== undefined)
                  setValue('date', date, { shouldValidate: true, shouldDirty: true });
                if (time !== undefined)
                  setValue('time', time, { shouldValidate: true, shouldDirty: true });
              }}
            />
            {(errors.date || errors.time) && (
              <p className="text-xs text-red-400">
                {errors.date?.message ?? errors.time?.message}
              </p>
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
