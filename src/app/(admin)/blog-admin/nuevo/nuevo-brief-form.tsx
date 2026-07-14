"use client";

import { useState, useTransition, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { createBrief } from "@/lib/blog/actions/briefs";
import { generateDraft } from "@/lib/blog/actions/drafts";
import { BlogBriefSchema, type BlogBriefInput } from "@/lib/blog/schemas";
import { cn } from "@/lib/utils";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const TONE_OPTIONS = [
  { value: "técnico-directo", label: "Técnico directo" },
  { value: "educativo", label: "Educativo" },
  { value: "opinión-defendida", label: "Opinión defendida" },
  { value: "caso-práctico", label: "Caso práctico" },
] as const;

// ─── Tag Input ─────────────────────────────────────────────────────────────────

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  error?: string;
}

function TagInput({ value, onChange, error }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || value.includes(tag) || value.length >= 8) return;
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
          placeholder={
            value.length === 0
              ? "Escribe un punto y presiona Enter o coma…"
              : value.length < 8
                ? "Agregar otro punto…"
                : "Máximo 8 puntos"
          }
          disabled={value.length >= 8}
          className="min-w-[200px] flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:cursor-not-allowed"
        />
      </div>
      <p className="text-xs text-muted-foreground/60">
        {value.length}/8 puntos · mínimo 2
      </p>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ─── Loading overlay ───────────────────────────────────────────────────────────

function GeneratingOverlay({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-background/80 backdrop-blur-sm">
      <Spinner size="lg" className="text-blue-400" />
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  );
}

// ─── Form component ────────────────────────────────────────────────────────────

export function NuevoBriefForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadingMessage, setLoadingMessage] = useState("");

  const form = useForm<BlogBriefInput>({
    resolver: zodResolver(BlogBriefSchema),
    defaultValues: {
      topic: "",
      angle: "",
      targetAudience: "",
      keyPoints: [],
      tone: "técnico-directo",
    },
  });

  const onSubmit = (data: BlogBriefInput) => {
    startTransition(async () => {
      // Step 1: create brief
      setLoadingMessage("Guardando brief…");
      const briefResult = await createBrief(data);
      if (!briefResult.ok || !briefResult.data) {
        toast.error(briefResult.error ?? "Error al crear brief");
        setLoadingMessage("");
        return;
      }

      // Step 2: generate draft
      setLoadingMessage("Llamando a Claude…");
      const draftResult = await generateDraft(briefResult.data.briefId);
      setLoadingMessage("");

      if (!draftResult.ok || !draftResult.data) {
        toast.error(draftResult.error ?? "Error al generar borrador");
        return;
      }

      toast.success("Borrador generado con éxito");
      router.push(`/blog-admin/${draftResult.data.postId}/editar`);
    });
  };

  return (
    <div className="relative">
      {isPending && loadingMessage && (
        <GeneratingOverlay message={loadingMessage} />
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Topic */}
          <FormField
            control={form.control}
            name="topic"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-muted-foreground">
                  Tema del artículo
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="ej: Cómo migrar de MySQL a Firestore en producción"
                    className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Angle */}
          <FormField
            control={form.control}
            name="angle"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-muted-foreground">
                  Ángulo técnico específico
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={3}
                    placeholder="ej: Sin downtime usando doble-write pattern, enfocado en equipos de 2-5 ingenieros"
                    className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 resize-none"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Target audience */}
          <FormField
            control={form.control}
            name="targetAudience"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-muted-foreground">
                  Audiencia objetivo
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="ej: CTOs de startups mexicanas con equipos pequeños"
                    className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Key points (tag input) */}
          <FormField
            control={form.control}
            name="keyPoints"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-muted-foreground">
                  Puntos clave (mín 2, máx 8)
                </FormLabel>
                <FormControl>
                  <TagInput
                    value={field.value}
                    onChange={field.onChange}
                    error={
                      form.formState.errors.keyPoints?.message ??
                      (form.formState.errors.keyPoints as { root?: { message?: string } })?.root?.message
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Tone */}
          <FormField
            control={form.control}
            name="tone"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-muted-foreground">Tono</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="bg-background border-border text-foreground focus:border-blue-500/50">
                      <SelectValue placeholder="Selecciona el tono" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="border-border bg-popover/95 backdrop-blur-xl">
                    {TONE_OPTIONS.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        className="text-popover-foreground focus:bg-secondary focus:text-foreground"
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={isPending}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-60"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" />
                Generando…
              </span>
            ) : (
              "Generar borrador con IA"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
