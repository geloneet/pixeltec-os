import type { LucideIcon } from 'lucide-react';
import { Circle, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';

export const TIMEZONE = 'America/Mexico_City';
export const WEEK_STARTS_ON = 1 as const;

export const CATEGORIES = [
  { value: 'trabajo',     label: 'Trabajo',     color: '#3b82f6' },
  { value: 'cliente',     label: 'Cliente',     color: '#06b6d4' },
  { value: 'personal',    label: 'Personal',    color: '#71717a' },
  { value: 'salud',       label: 'Salud',       color: '#22c55e' },
  { value: 'aprendizaje', label: 'Aprendizaje', color: '#a855f7' },
] as const;

export const STATUSES: Array<{
  value: string;
  label: string;
  color: string;
  icon: LucideIcon;
}> = [
  { value: 'pending',     label: 'Pendiente',   color: '#71717a', icon: Circle       },
  { value: 'in_progress', label: 'En progreso', color: '#f59e0b', icon: Loader2      },
  { value: 'completed',   label: 'Completada',  color: '#22c55e', icon: CheckCircle2 },
  { value: 'cancelled',   label: 'Cancelada',   color: '#ef4444', icon: XCircle      },
  { value: 'postponed',   label: 'Pospuesta',   color: '#a855f7', icon: Clock        },
];

export const DAYS_OF_WEEK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;
