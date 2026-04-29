'use client';

import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CATEGORIES } from '@/lib/assistant/constants';
import {
  WEEKDAY_CODES,
  AssistantTemplateCreateSchema,
  type AssistantTemplateCreateInput,
  type WeekdayCode,
} from '@/lib/assistant/schemas';
import { WEEKDAY_LABELS, parseWeekdaysFromRRule } from '@/lib/assistant/rrule-helpers';
import type { AssistantTemplateSerialized } from '@/lib/assistant/types';
import { createTemplate, updateTemplate } from '@/lib/assistant/actions/templates';

interface Props {
  mode: 'create' | 'edit';
  template?: AssistantTemplateSerialized;
}

export function TemplateFormClient({ mode, template }: Props) {
  const router = useRouter();

  const defaultValues: Partial<AssistantTemplateCreateInput> =
    mode === 'edit' && template
      ? {
          title: template.title,
          description: template.description ?? undefined,
          category: template.category,
          weekdays: parseWeekdaysFromRRule(template.rrule),
          defaultTime: template.defaultTime,
          durationMin: template.durationMin,
        }
      : {
          durationMin: 60,
          weekdays: [],
        };

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AssistantTemplateCreateInput>({
    resolver: zodResolver(AssistantTemplateCreateSchema),
    defaultValues,
  });

  async function onSubmit(data: AssistantTemplateCreateInput) {
    if (mode === 'create') {
      const result = await createTemplate(data);
      if (result.ok) {
        toast.success('Template guardado');
        router.push('/asistente/templates');
      } else {
        toast.error(result.error ?? 'Error');
      }
    } else if (template) {
      const result = await updateTemplate(template.id, data);
      if (result.ok) {
        toast.success('Template guardado');
        router.push('/asistente/templates');
      } else {
        toast.error(result.error ?? 'Error');
      }
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/asistente/templates"
          className="text-zinc-400 hover:text-zinc-100 text-sm transition-colors"
        >
          ← Templates
        </Link>
        <span className="text-zinc-600">/</span>
        <h1 className="text-xl font-semibold text-zinc-100">
          {mode === 'create' ? 'Nuevo template' : 'Editar template'}
        </h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title" className="text-zinc-300">Título</Label>
          <Input
            id="title"
            placeholder="Nombre de la actividad"
            className="bg-zinc-800 border-zinc-600"
            {...register('title')}
          />
          {errors.title && (
            <p className="text-xs text-red-400">{errors.title.message}</p>
          )}
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description" className="text-zinc-300">
            Descripción <span className="text-zinc-500">(opcional)</span>
          </Label>
          <Textarea
            id="description"
            placeholder="Descripción o notas adicionales"
            className="bg-zinc-800 border-zinc-600 resize-none"
            rows={3}
            {...register('description')}
          />
          {errors.description && (
            <p className="text-xs text-red-400">{errors.description.message}</p>
          )}
        </div>

        {/* Category */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-zinc-300">Categoría</Label>
          <Controller
            name="category"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
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
            )}
          />
          {errors.category && (
            <p className="text-xs text-red-400">{errors.category.message}</p>
          )}
        </div>

        {/* Weekdays */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-zinc-300">Días de la semana</Label>
          <Controller
            name="weekdays"
            control={control}
            render={({ field }) => (
              <div className="flex gap-1.5 flex-wrap">
                {WEEKDAY_CODES.map((code) => {
                  const selected = field.value?.includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        const current = field.value ?? [];
                        field.onChange(
                          selected
                            ? current.filter((d: WeekdayCode) => d !== code)
                            : [...current, code],
                        );
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        selected
                          ? 'bg-zinc-100 text-zinc-900'
                          : 'bg-white/[0.06] text-zinc-400 hover:bg-white/[0.1]'
                      }`}
                    >
                      {WEEKDAY_LABELS[code]}
                    </button>
                  );
                })}
              </div>
            )}
          />
          {errors.weekdays && (
            <p className="text-xs text-red-400">{errors.weekdays.message}</p>
          )}
        </div>

        {/* Default time */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="defaultTime" className="text-zinc-300">Hora por defecto</Label>
          <Input
            id="defaultTime"
            type="time"
            className="bg-zinc-800 border-zinc-600"
            {...register('defaultTime')}
          />
          {errors.defaultTime && (
            <p className="text-xs text-red-400">{errors.defaultTime.message}</p>
          )}
        </div>

        {/* Duration */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="durationMin" className="text-zinc-300">Duración (minutos)</Label>
          <Input
            id="durationMin"
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

        {/* Footer buttons */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/asistente/templates')}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando…' : 'Guardar template'}
          </Button>
        </div>
      </form>
    </div>
  );
}
