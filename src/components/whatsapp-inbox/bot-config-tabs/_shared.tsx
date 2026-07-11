"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { parseCanonical } from "@/lib/whatsapp-inbox/time";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

/** Card de sección — mismo patrón visual usado en todo el módulo de config. */
export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-zinc-800/60 p-3">
      <p className="text-[11px] uppercase tracking-wider text-zinc-500">{title}</p>
      {children}
    </div>
  );
}

export type ListAccent = "default" | "emerald" | "red" | "amber";

const ACCENT_CLASSES: Record<ListAccent, string> = {
  default: "border-zinc-700 bg-zinc-800/60 text-zinc-300",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  red: "border-red-500/30 bg-red-500/10 text-red-300",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

interface ListEditorProps {
  label?: string;
  hint?: string;
  items: string[];
  onChange: (items: string[]) => void;
  accent?: ListAccent;
  maxItems?: number;
  maxItemLen?: number;
}

/** Editor de lista de textos como chips removibles — usado en varias secciones
 * (can_answer, traits, forbidden_phrases, no_invent, etc.). */
export function ListEditor({
  label,
  hint,
  items,
  onChange,
  accent = "default",
  maxItems = 20,
  maxItemLen = 200,
}: ListEditorProps) {
  const [input, setInput] = useState("");

  function handleAdd() {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (items.includes(trimmed)) {
      setInput("");
      return;
    }
    if (items.length >= maxItems) {
      toast.error(`Máximo ${maxItems} elementos en esta lista`);
      return;
    }
    if (trimmed.length > maxItemLen) {
      toast.error(`Máximo ${maxItemLen} caracteres por elemento`);
      return;
    }
    onChange([...items, trimmed]);
    setInput("");
  }

  function handleRemove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-medium text-zinc-300">{label}</p>}
      {hint && <p className="text-[11px] text-zinc-500">{hint}</p>}
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 && <span className="text-xs text-zinc-600">Sin elementos</span>}
        {items.map((item, idx) => (
          <Badge
            key={`${idx}-${item}`}
            variant="outline"
            className={cn("gap-1 font-normal", ACCENT_CLASSES[accent])}
          >
            <span className="max-w-[240px] truncate">{item}</span>
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              aria-label={`Quitar "${item}"`}
              className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Escribe y presiona Enter…"
          maxLength={maxItemLen}
          className="h-8 border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
        />
        <span className="flex-shrink-0 text-[11px] text-zinc-600">
          {items.length}/{maxItems}
        </span>
      </div>
    </div>
  );
}

export function extractErrorMessage(data: { error?: string; detail?: string }, status: number): string {
  return data.error ?? data.detail ?? `HTTP ${status}`;
}

export function formatUpdatedAt(canonical: string): string {
  try {
    return parseCanonical(canonical).toLocaleString("es-MX", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return canonical;
  }
}
