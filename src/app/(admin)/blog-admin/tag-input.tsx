"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Máximo de etiquetas permitidas (tags: 8, keywords secundarias: 10). */
  maxTags?: number;
  placeholder?: string;
  /** Nota bajo el input (p. ej. contador «3/10 keywords»). */
  footer?: string;
  /** Mensaje de error de validación: borde rojo + texto bajo el input. */
  error?: string;
}

/** Input de etiquetas compartido del Blog Admin (editor, SEO y formulario de
 *  brief): Enter/coma agrega, Backspace con input vacío quita la última. */
export function TagInput({
  value,
  onChange,
  maxTags = 8,
  placeholder = "Agregar etiqueta…",
  footer,
  error,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || value.includes(tag) || value.length >= maxTags) return;
    onChange([...value, tag]);
    setInputValue("");
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex min-h-[42px] flex-wrap gap-1.5 rounded-md border bg-background px-3 py-2",
          error ? "border-red-500/60" : "border-border",
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-blue-400 hover:text-blue-200 transition-colors"
              aria-label={`Eliminar ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (inputValue.trim()) addTag(inputValue);
          }}
          placeholder={value.length === 0 ? placeholder : ""}
          disabled={value.length >= maxTags}
          className="min-w-[120px] flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:cursor-not-allowed"
        />
      </div>
      {footer && <p className="text-xs text-muted-foreground/60">{footer}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
