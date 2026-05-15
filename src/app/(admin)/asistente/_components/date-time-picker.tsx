'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { es } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  /** YYYY-MM-DD or empty */
  date: string | undefined;
  /** HH:mm or empty */
  time: string | undefined;
  onChange: (next: { date?: string; time?: string }) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

function parseLocalDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatLabel(date?: string, time?: string): string {
  if (!date && !time) return '';
  const parsed = parseLocalDate(date);
  const datePart = parsed
    ? parsed.toLocaleDateString('es-MX', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';
  return `${datePart}${time ? ` · ${time}` : ''}`;
}

export function DateTimePicker({
  date,
  time,
  onChange,
  disabled,
  placeholder = 'Selecciona fecha y hora',
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const dateTouched = useRef(false);
  const timeTouched = useRef(false);

  useEffect(() => {
    if (!open) {
      dateTouched.current = false;
      timeTouched.current = false;
    }
  }, [open]);

  const selectedDate = useMemo(() => parseLocalDate(date), [date]);
  const [hh, mm] = useMemo(() => {
    if (!time) return ['', ''];
    const m = /^(\d{2}):(\d{2})$/.exec(time);
    return m ? [m[1], m[2]] : ['', ''];
  }, [time]);

  const label = formatLabel(date, time);

  function commitDate(d: Date | undefined) {
    if (!d) return;
    const next = toDateString(d);
    onChange({ date: next, time });
    dateTouched.current = true;
    if (timeTouched.current && time) setOpen(false);
  }

  function commitTime(nextHh: string, nextMm: string) {
    const nh = nextHh || hh || '09';
    const nm = nextMm || mm || '00';
    const nextTime = `${nh}:${nm}`;
    onChange({ date, time: nextTime });
    timeTouched.current = true;
    if (dateTouched.current && date) setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start gap-2 bg-zinc-800 border-zinc-600 font-normal text-zinc-100 hover:bg-zinc-700 hover:text-zinc-100',
            !label && 'text-zinc-400',
            className,
          )}
        >
          <CalendarClock className="h-4 w-4 shrink-0 text-zinc-400" />
          <span className="truncate">{label || placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-0 bg-zinc-900 border-zinc-700 text-zinc-100"
      >
        <div className="flex flex-col sm:flex-row">
          <Calendar
            mode="single"
            locale={es}
            weekStartsOn={1}
            selected={selectedDate}
            onSelect={commitDate}
            initialFocus
          />
          <div className="flex flex-col gap-2 border-t border-zinc-700 p-3 sm:border-t-0 sm:border-l sm:w-44">
            <div className="text-xs uppercase tracking-wide text-zinc-400">Hora</div>
            <div className="flex items-center gap-2">
              <Select
                value={hh}
                onValueChange={(v) => commitTime(v, mm)}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-600 w-20">
                  <SelectValue placeholder="HH" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700 max-h-60">
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-zinc-500">:</span>
              <Select
                value={mm}
                onValueChange={(v) => commitTime(hh, v)}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-600 w-20">
                  <SelectValue placeholder="mm" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700 max-h-60">
                  {MINUTES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-[11px] text-zinc-500">
              Selecciona fecha y hora para cerrar automáticamente.
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
