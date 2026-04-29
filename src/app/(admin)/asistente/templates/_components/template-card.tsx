'use client';

import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { CATEGORIES } from '@/lib/assistant/constants';
import { WEEKDAY_LABELS, parseWeekdaysFromRRule } from '@/lib/assistant/rrule-helpers';
import type { AssistantTemplateSerialized } from '@/lib/assistant/types';

interface Props {
  template: AssistantTemplateSerialized;
  onToggleActive: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TemplateCard({ template, onToggleActive, onDelete }: Props) {
  const cat = CATEGORIES.find((c) => c.value === template.category);
  const catColor = cat?.color ?? '#71717a';
  const catLabel = cat?.label ?? template.category;
  const weekdays = parseWeekdaysFromRRule(template.rrule);

  return (
    <div
      className="rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.05] transition-colors"
      style={{ borderLeft: `2px solid ${catColor}`, opacity: template.active ? 1 : 0.6 }}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Clickable content area */}
        <Link
          href={`/asistente/templates/${template.id}/editar`}
          className="flex-1 min-w-0"
        >
          {/* Row 1: title + badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-zinc-100 truncate">{template.title}</span>
            <Badge
              variant="outline"
              className="text-[10px] shrink-0"
              style={{ color: catColor, borderColor: catColor + '40' }}
            >
              {catLabel}
            </Badge>
          </div>
          {/* Row 2: days + time + duration */}
          <div className="flex flex-wrap items-center gap-1.5">
            {weekdays.map((d) => (
              <span
                key={d}
                className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-400"
              >
                {WEEKDAY_LABELS[d]}
              </span>
            ))}
            <span className="text-[10px] text-zinc-500 ml-1">{template.defaultTime}</span>
            <span className="text-[10px] text-zinc-600">·</span>
            <span className="text-[10px] text-zinc-500">{template.durationMin} min</span>
          </div>
        </Link>

        {/* Controls: Switch + Menu */}
        <div
          className="flex items-center gap-2 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Switch
            checked={template.active}
            onCheckedChange={() => onToggleActive(template.id)}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-zinc-400 hover:text-zinc-100"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="bg-zinc-900 border-zinc-700 text-zinc-100"
              align="end"
            >
              <DropdownMenuItem asChild>
                <Link href={`/asistente/templates/${template.id}/editar`}>Editar</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-700" />
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
                    <AlertDialogTitle>¿Eliminar template?</AlertDialogTitle>
                    <AlertDialogDescription className="text-zinc-400">
                      Las tareas ya generadas no se eliminarán.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-zinc-700 text-zinc-300">
                      Cancelar
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700"
                      onClick={() => onDelete(template.id)}
                    >
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
