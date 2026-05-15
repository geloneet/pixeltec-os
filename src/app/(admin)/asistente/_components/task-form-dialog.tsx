'use client';

import { useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CATEGORIES } from '@/lib/assistant/constants';
import { formatDateMX, formatTimeMX } from '@/lib/assistant/week-helpers';
import {
  AssistantTaskCreateSchema,
  type AssistantTaskCreateInput,
} from '@/lib/assistant/schemas';
import { createTask, updateTask } from '@/lib/assistant/actions/tasks';
import type { AssistantTaskSerialized } from '@/lib/assistant/types';
import { DateTimePicker } from './date-time-picker';

interface Props {
  open: boolean;
  task?: AssistantTaskSerialized;
  onClose: () => void;
  onSave: (task: AssistantTaskSerialized) => void;
}

export function TaskFormDialog({ open, task, onClose, onSave }: Props) {
  const isEditing = !!task;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AssistantTaskCreateInput>({
    resolver: zodResolver(AssistantTaskCreateSchema),
    defaultValues: { durationMin: 60 },
  });

  useEffect(() => {
    if (task) {
      const startsAt = new Date(task.startsAt);
      reset({
        title:       task.title,
        description: task.description ?? undefined,
        category:    task.category,
        date:        formatDateMX(startsAt),
        time:        formatTimeMX(startsAt),
        durationMin: task.durationMin,
      });
    } else {
      reset({ durationMin: 60 });
    }
  }, [task, reset]);

  async function onSubmit(data: AssistantTaskCreateInput) {
    if (isEditing && task) {
      const result = await updateTask(task.id, data);
      if (!result.ok || !result.data) {
        toast.error(result.error ?? 'Error al actualizar');
        return;
      }
      onSave(result.data);
      toast.success('Tarea actualizada');
    } else {
      const result = await createTask(data);
      if (!result.ok || !result.data) {
        toast.error(result.error ?? 'Error al crear');
        return;
      }
      onSave(result.data);
      toast.success('Tarea creada');
    }
    onClose();
  }

  const categoryValue = watch('category');
  const dateValue = watch('date');
  const timeValue = watch('time');

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="tf-title">Título</Label>
            <Input
              id="tf-title"
              className="bg-zinc-800 border-zinc-600"
              placeholder="Ej: Revisar propuesta cliente X"
              {...register('title')}
            />
            {errors.title && (
              <p className="text-xs text-red-400">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="tf-desc">Descripción (opcional)</Label>
            <Textarea
              id="tf-desc"
              className="bg-zinc-800 border-zinc-600 resize-none"
              rows={2}
              placeholder="Notas adicionales…"
              {...register('description')}
            />
            {errors.description && (
              <p className="text-xs text-red-400">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Categoría</Label>
            <Select
              value={categoryValue}
              onValueChange={(v) =>
                setValue('category', v as AssistantTaskCreateInput['category'])
              }
            >
              <SelectTrigger className="bg-zinc-800 border-zinc-600">
                <SelectValue placeholder="Selecciona categoría" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-xs text-red-400">{errors.category.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Fecha y hora</Label>
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

          <div className="space-y-1">
            <Label htmlFor="tf-dur">Duración (min)</Label>
            <Input
              id="tf-dur"
              type="number"
              min={15}
              max={480}
              step={15}
              className="bg-zinc-800 border-zinc-600"
              {...register('durationMin', { valueAsNumber: true })}
            />
            {errors.durationMin && (
              <p className="text-xs text-red-400">{errors.durationMin.message}</p>
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
              {isSubmitting
                ? 'Guardando…'
                : isEditing
                  ? 'Guardar cambios'
                  : 'Crear tarea'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
