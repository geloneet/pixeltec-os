"use client";

import { useState, useTransition, KeyboardEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ChevronDown, Plus, Trash2, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { createBrief } from "@/lib/blog/actions/briefs";
import { generateDraft } from "@/lib/blog/actions/drafts";
import {
  BlogBriefSchema,
  type BlogBriefInput,
  type PostSourceInput,
} from "@/lib/blog/schemas";
import type { BriefInternalLinkTarget } from "@/lib/blog/types";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

// ─── Opciones (labels en español para no-especialistas SEO) ────────────────────

const TONE_OPTIONS = [
  { value: "técnico-directo", label: "Técnico directo" },
  { value: "educativo", label: "Educativo" },
  { value: "opinión-defendida", label: "Opinión defendida" },
  { value: "caso-práctico", label: "Caso práctico" },
] as const;

const SEARCH_INTENT_OPTIONS = [
  { value: "informational", label: "Informacional — quiere aprender algo" },
  {
    value: "commercial-investigation",
    label: "Investigación comercial — compara opciones antes de decidir",
  },
  { value: "transactional", label: "Transaccional — listo para contratar/comprar" },
  { value: "navigational", label: "Navegacional — busca un sitio o marca concreta" },
] as const;

const FUNNEL_STAGE_OPTIONS = [
  { value: "awareness", label: "Descubrimiento — apenas conoce el problema" },
  { value: "consideration", label: "Consideración — evalúa soluciones" },
  { value: "decision", label: "Decisión — listo para elegir proveedor" },
] as const;

const SOURCE_TYPE_OPTIONS = [
  { value: "official", label: "Fuente oficial" },
  { value: "primary-research", label: "Investigación primaria (estudio, encuesta)" },
  { value: "regulation", label: "Regulación / normativa" },
  { value: "technical-documentation", label: "Documentación técnica" },
  { value: "reputable-secondary", label: "Fuente secundaria confiable" },
  { value: "pixeltec-evidence", label: "Evidencia propia de PixelTEC" },
] as const;

/** Sentinel para selects opcionales (Radix no permite value=""). */
const NONE = "__none__";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Tag Input (patrón de keyPoints, parametrizado) ────────────────────────────

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  error?: string;
  max?: number;
  footer?: string;
  emptyPlaceholder?: string;
}

function TagInput({
  value,
  onChange,
  error,
  max = 8,
  footer,
  emptyPlaceholder = "Escribe un punto y presiona Enter o coma…",
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || value.includes(tag) || value.length >= max) return;
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
              ? emptyPlaceholder
              : value.length < max
                ? "Agregar otro…"
                : `Máximo ${max}`
          }
          disabled={value.length >= max}
          className="min-w-[200px] flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:cursor-not-allowed"
        />
      </div>
      {footer && <p className="text-xs text-muted-foreground/60">{footer}</p>}
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

// ─── Sección colapsable ────────────────────────────────────────────────────────

interface FormSectionProps {
  number: string;
  title: string;
  subtitle: string;
  optional?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

function FormSection({
  number,
  title,
  subtitle,
  optional,
  open,
  onOpenChange,
  children,
}: FormSectionProps) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="rounded-lg border border-border bg-background/40"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {number}. {title}
              </span>
              {optional && (
                <Badge
                  variant="outline"
                  className="border-blue-500/40 text-[10px] font-normal text-blue-600 dark:text-blue-300"
                >
                  Recomendado para SEO · no obligatorio
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <ChevronDown
            className={cn(
              "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-5 border-t border-border px-4 py-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Primer mensaje de error del árbol de errores de react-hook-form. */
function firstErrorMessage(errors: FieldErrors<BlogBriefInput>): string | null {
  const walk = (node: unknown): string | null => {
    if (!node || typeof node !== "object") return null;
    const rec = node as Record<string, unknown>;
    if (typeof rec.message === "string" && rec.message) return rec.message;
    for (const key of Object.keys(rec)) {
      if (key === "ref") continue; // nodos DOM: evitar ciclos
      const found = walk(rec[key]);
      if (found) return found;
    }
    return null;
  };
  return walk(errors);
}

function newEmptySource(): PostSourceInput {
  return {
    id: crypto.randomUUID(),
    title: "",
    url: "",
    publisher: "",
    sourceType: "reputable-secondary",
    claimSupported: "",
    accessedAt: todayISO(),
    verifiedByHuman: false,
  };
}

function newEmptyLink(): BriefInternalLinkTarget {
  return { url: "", purpose: "", suggestedAnchor: "" };
}

type SectionKey = "estrategia" | "contenido" | "evidencia" | "enlaces";

const inputCls =
  "bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50";

// ─── Form component ────────────────────────────────────────────────────────────

export function NuevoBriefForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadingMessage, setLoadingMessage] = useState("");
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    estrategia: false,
    contenido: true,
    evidencia: false,
    enlaces: false,
  });

  function setSection(key: SectionKey) {
    return (open: boolean) => setOpenSections((s) => ({ ...s, [key]: open }));
  }

  function openAllSections() {
    setOpenSections({ estrategia: true, contenido: true, evidencia: true, enlaces: true });
  }

  const form = useForm<BlogBriefInput>({
    resolver: zodResolver(BlogBriefSchema),
    defaultValues: {
      topic: "",
      angle: "",
      targetAudience: "",
      keyPoints: [],
      tone: "técnico-directo",
      userProblem: "",
      searchIntent: "",
      primaryKeyword: "",
      secondaryKeywords: [],
      entities: [],
      contentPillar: "",
      funnelStage: "",
      contentGoal: "",
      desiredAction: "",
      pixeltecExperience: [],
      internalLinkTargets: [],
      sources: [],
    },
  });

  const onSubmit = (data: BlogBriefInput) => {
    // Validación explícita con el schema completo (safeParse) — muestra el
    // primer error si algo no pasa el contrato.
    const parsed = BlogBriefSchema.safeParse(data);
    if (!parsed.success) {
      openAllSections();
      toast.error(parsed.error.errors[0]?.message ?? "Revisa los campos del brief");
      return;
    }

    startTransition(async () => {
      // Step 1: create brief
      setLoadingMessage("Guardando brief…");
      const briefResult = await createBrief(parsed.data);
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

  const onInvalid = (errors: FieldErrors<BlogBriefInput>) => {
    openAllSections();
    toast.error(firstErrorMessage(errors) ?? "Revisa los campos marcados");
  };

  // Resumen (sección 5)
  const watched = form.watch();
  const summaryIntent = SEARCH_INTENT_OPTIONS.find(
    (o) => o.value === watched.searchIntent,
  )?.label.split(" — ")[0];
  const summaryStage = FUNNEL_STAGE_OPTIONS.find(
    (o) => o.value === watched.funnelStage,
  )?.label.split(" — ")[0];

  const sourceErrors = form.formState.errors.sources;
  const linkErrors = form.formState.errors.internalLinkTargets;
  const experienceErrors = form.formState.errors.pixeltecExperience;

  return (
    <div className="relative">
      {isPending && loadingMessage && (
        <GeneratingOverlay message={loadingMessage} />
      )}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit, onInvalid)}
          className="space-y-4"
        >
          {/* ── 1. Estrategia ─────────────────────────────────────────────── */}
          <FormSection
            number="1"
            title="Estrategia"
            subtitle="Para quién escribes y qué quieres lograr. Ayuda a que el artículo posicione en Google."
            optional
            open={openSections.estrategia}
            onOpenChange={setSection("estrategia")}
          >
            <FormField
              control={form.control}
              name="userProblem"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">
                    Problema del lector
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={2}
                      placeholder="¿Qué problema real busca resolver el lector cuando llega a este artículo?"
                      className={cn(inputCls, "resize-none")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="searchIntent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">
                      Intención de búsqueda
                    </FormLabel>
                    <Select
                      value={field.value === "" ? NONE : field.value}
                      onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                    >
                      <FormControl>
                        <SelectTrigger className={inputCls}>
                          <SelectValue placeholder="¿Qué busca en Google?" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="border-border bg-popover/95 backdrop-blur-xl">
                        <SelectItem
                          value={NONE}
                          className="text-popover-foreground focus:bg-secondary focus:text-foreground"
                        >
                          Sin definir
                        </SelectItem>
                        {SEARCH_INTENT_OPTIONS.map((opt) => (
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
                    <p className="text-xs text-muted-foreground/60">
                      Qué espera encontrar quien busca este tema.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="funnelStage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">
                      Etapa del lector
                    </FormLabel>
                    <Select
                      value={field.value === "" ? NONE : field.value}
                      onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                    >
                      <FormControl>
                        <SelectTrigger className={inputCls}>
                          <SelectValue placeholder="¿Qué tan cerca está de contratar?" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="border-border bg-popover/95 backdrop-blur-xl">
                        <SelectItem
                          value={NONE}
                          className="text-popover-foreground focus:bg-secondary focus:text-foreground"
                        >
                          Sin definir
                        </SelectItem>
                        {FUNNEL_STAGE_OPTIONS.map((opt) => (
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
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="primaryKeyword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">
                      Keyword principal
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="ej: migrar mysql a firestore"
                        className={inputCls}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground/60">
                      La frase exacta que alguien escribiría en Google.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contentPillar"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">
                      Pilar de contenido
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="ej: Migraciones de bases de datos"
                        className={inputCls}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground/60">
                      Tema paraguas al que pertenece este artículo.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="secondaryKeywords"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">
                    Keywords secundarias
                  </FormLabel>
                  <FormControl>
                    <TagInput
                      value={field.value}
                      onChange={field.onChange}
                      max={10}
                      footer={`${field.value.length}/10 keywords`}
                      emptyPlaceholder="Escribe una keyword y presiona Enter o coma…"
                      error={form.formState.errors.secondaryKeywords?.message}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="contentGoal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">
                      Objetivo del artículo
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="ej: posicionar a PixelTEC como experto en migraciones"
                        className={inputCls}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="desiredAction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">
                      Acción deseada del lector
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="ej: agendar una llamada de diagnóstico"
                        className={inputCls}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </FormSection>

          {/* ── 2. Contenido ──────────────────────────────────────────────── */}
          <FormSection
            number="2"
            title="Contenido"
            subtitle="Lo esencial del artículo. Estos 5 campos son obligatorios."
            open={openSections.contenido}
            onOpenChange={setSection("contenido")}
          >
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
                      className={inputCls}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      className={cn(inputCls, "resize-none")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      className={inputCls}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      footer={`${field.value.length}/8 puntos · mínimo 2`}
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
                      <SelectTrigger className={inputCls}>
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
          </FormSection>

          {/* ── 3. Evidencia ──────────────────────────────────────────────── */}
          <FormSection
            number="3"
            title="Evidencia"
            subtitle="Experiencia propia y fuentes que respaldan lo que afirma el artículo."
            optional
            open={openSections.evidencia}
            onOpenChange={setSection("evidencia")}
          >
            {/* Experiencia PixelTEC */}
            <FormField
              control={form.control}
              name="pixeltecExperience"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">
                    Experiencia PixelTEC
                  </FormLabel>
                  <p className="text-xs text-muted-foreground/60">
                    Experiencia propia, casos o decisiones que diferencien el
                    artículo de lo que ya existe en internet.
                  </p>
                  <div className="space-y-2">
                    {field.value.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <Textarea
                          value={item}
                          onChange={(e) => {
                            const next = [...field.value];
                            next[idx] = e.target.value;
                            field.onChange(next);
                          }}
                          rows={2}
                          placeholder="ej: En el proyecto X redujimos el downtime a cero usando…"
                          className={cn(inputCls, "resize-none")}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            field.onChange(field.value.filter((_, i) => i !== idx))
                          }
                          aria-label={`Eliminar experiencia ${idx + 1}`}
                          className="mt-1 text-muted-foreground hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {experienceErrors && (
                      <p className="text-xs text-red-400">
                        {firstErrorMessage({
                          pixeltecExperience: experienceErrors,
                        } as FieldErrors<BlogBriefInput>) ?? "Revisa las experiencias"}
                      </p>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={field.value.length >= 10}
                      onClick={() => field.onChange([...field.value, ""])}
                      className="border-border text-muted-foreground"
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Agregar experiencia
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="border-t border-border pt-4" />

            {/* Fuentes */}
            <FormField
              control={form.control}
              name="sources"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">Fuentes</FormLabel>
                  <p className="text-xs text-muted-foreground/60">
                    Enlaces que respaldan afirmaciones concretas del artículo. La
                    verificación es tuya (humana): nadie va a abrir la URL por ti.
                  </p>
                  <div className="space-y-3">
                    {field.value.map((source, idx) => {
                      const errs = sourceErrors?.[idx];
                      const update = (patch: Partial<PostSourceInput>) => {
                        const next = [...field.value];
                        next[idx] = { ...next[idx], ...patch };
                        field.onChange(next);
                      };
                      return (
                        <div
                          key={source.id}
                          className="space-y-3 rounded-md border border-border bg-background/60 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              Fuente {idx + 1}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                field.onChange(
                                  field.value.filter((_, i) => i !== idx),
                                )
                              }
                              aria-label={`Eliminar fuente ${idx + 1}`}
                              className="h-7 w-7 text-muted-foreground hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div>
                            <Label className="text-xs text-muted-foreground">
                              Título
                            </Label>
                            <Input
                              value={source.title}
                              onChange={(e) => update({ title: e.target.value })}
                              placeholder="ej: Documentación oficial de Firestore"
                              className={cn(inputCls, "mt-1")}
                            />
                            {errs?.title?.message && (
                              <p className="mt-1 text-xs text-red-400">
                                {errs.title.message}
                              </p>
                            )}
                          </div>

                          <div>
                            <Label className="text-xs text-muted-foreground">
                              URL
                            </Label>
                            <Input
                              value={source.url}
                              onChange={(e) => update({ url: e.target.value })}
                              placeholder="https://…"
                              inputMode="url"
                              className={cn(inputCls, "mt-1")}
                            />
                            {errs?.url?.message && (
                              <p className="mt-1 text-xs text-red-400">
                                {errs.url.message}
                              </p>
                            )}
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">
                                Publicador
                              </Label>
                              <Input
                                value={source.publisher}
                                onChange={(e) =>
                                  update({ publisher: e.target.value })
                                }
                                placeholder="ej: Google Cloud"
                                className={cn(inputCls, "mt-1")}
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">
                                Tipo de fuente
                              </Label>
                              <Select
                                value={source.sourceType}
                                onValueChange={(v) =>
                                  update({
                                    sourceType: v as PostSourceInput["sourceType"],
                                  })
                                }
                              >
                                <SelectTrigger className={cn(inputCls, "mt-1")}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="border-border bg-popover/95 backdrop-blur-xl">
                                  {SOURCE_TYPE_OPTIONS.map((opt) => (
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
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs text-muted-foreground">
                              ¿Qué afirmación respalda?
                            </Label>
                            <Textarea
                              value={source.claimSupported}
                              onChange={(e) =>
                                update({ claimSupported: e.target.value })
                              }
                              rows={2}
                              placeholder="ej: Firestore garantiza consistencia fuerte en lecturas por documento"
                              className={cn(inputCls, "mt-1 resize-none")}
                            />
                            {errs?.claimSupported?.message && (
                              <p className="mt-1 text-xs text-red-400">
                                {errs.claimSupported.message}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-end gap-4">
                            <div>
                              <Label className="text-xs text-muted-foreground">
                                Fecha de consulta
                              </Label>
                              <Input
                                type="date"
                                value={source.accessedAt}
                                onChange={(e) =>
                                  update({ accessedAt: e.target.value })
                                }
                                className={cn(inputCls, "mt-1 w-auto")}
                              />
                            </div>
                            <label className="flex cursor-pointer items-center gap-2 pb-2">
                              <Checkbox
                                checked={source.verifiedByHuman}
                                onCheckedChange={(checked) =>
                                  update({ verifiedByHuman: checked === true })
                                }
                              />
                              <span className="text-xs text-muted-foreground">
                                La abrí y verifiqué que respalda el claim
                              </span>
                            </label>
                          </div>
                        </div>
                      );
                    })}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={field.value.length >= 20}
                      onClick={() =>
                        field.onChange([...field.value, newEmptySource()])
                      }
                      className="border-border text-muted-foreground"
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Agregar fuente
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormSection>

          {/* ── 4. Enlaces internos ───────────────────────────────────────── */}
          <FormSection
            number="4"
            title="Enlaces internos"
            subtitle="Páginas de pixeltec.mx que el artículo debería enlazar (servicios, otros posts)."
            optional
            open={openSections.enlaces}
            onOpenChange={setSection("enlaces")}
          >
            <FormField
              control={form.control}
              name="internalLinkTargets"
              render={({ field }) => (
                <FormItem>
                  <div className="space-y-3">
                    {field.value.map((link, idx) => {
                      const errs = linkErrors?.[idx];
                      const update = (
                        patch: Partial<BriefInternalLinkTarget>,
                      ) => {
                        const next = [...field.value];
                        next[idx] = { ...next[idx], ...patch };
                        field.onChange(next);
                      };
                      return (
                        <div
                          key={idx}
                          className="space-y-3 rounded-md border border-border bg-background/60 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              Enlace {idx + 1}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                field.onChange(
                                  field.value.filter((_, i) => i !== idx),
                                )
                              }
                              aria-label={`Eliminar enlace ${idx + 1}`}
                              className="h-7 w-7 text-muted-foreground hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div>
                            <Label className="text-xs text-muted-foreground">
                              URL (relativa o de pixeltec.mx)
                            </Label>
                            <Input
                              value={link.url}
                              onChange={(e) => update({ url: e.target.value })}
                              placeholder="ej: /servicios/automatizacion"
                              className={cn(inputCls, "mt-1")}
                            />
                            {errs?.url?.message && (
                              <p className="mt-1 text-xs text-red-400">
                                {errs.url.message}
                              </p>
                            )}
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">
                                Propósito
                              </Label>
                              <Input
                                value={link.purpose}
                                onChange={(e) =>
                                  update({ purpose: e.target.value })
                                }
                                placeholder="¿Por qué enlazar esta página?"
                                className={cn(inputCls, "mt-1")}
                              />
                              {errs?.purpose?.message && (
                                <p className="mt-1 text-xs text-red-400">
                                  {errs.purpose.message}
                                </p>
                              )}
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">
                                Anchor sugerido
                              </Label>
                              <Input
                                value={link.suggestedAnchor ?? ""}
                                onChange={(e) =>
                                  update({ suggestedAnchor: e.target.value })
                                }
                                placeholder="ej: automatización de procesos"
                                className={cn(inputCls, "mt-1")}
                              />
                              {errs?.suggestedAnchor?.message && (
                                <p className="mt-1 text-xs text-red-400">
                                  {errs.suggestedAnchor.message}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={field.value.length >= 10}
                      onClick={() =>
                        field.onChange([...field.value, newEmptyLink()])
                      }
                      className="border-border text-muted-foreground"
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Agregar enlace interno
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormSection>

          {/* ── 5. Generación ─────────────────────────────────────────────── */}
          <div className="space-y-4 rounded-lg border border-border bg-background/40 px-4 py-4">
            <div>
              <span className="text-sm font-semibold text-foreground">
                5. Generación
              </span>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Revisa el resumen y genera el borrador. Las secciones 1, 3 y 4
                son recomendadas para SEO, no obligatorias.
              </p>
            </div>

            <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">Tema:</dt>
                <dd className="truncate text-foreground">
                  {watched.topic || "—"}
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">Keyword principal:</dt>
                <dd className="truncate text-foreground">
                  {watched.primaryKeyword || "—"}
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">Intención:</dt>
                <dd className="text-foreground">{summaryIntent ?? "—"}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">Etapa:</dt>
                <dd className="text-foreground">{summaryStage ?? "—"}</dd>
              </div>
              <div className="flex gap-1.5 sm:col-span-2">
                <dt className="text-muted-foreground">Completado:</dt>
                <dd className="text-foreground">
                  {watched.keyPoints.length} puntos clave ·{" "}
                  {watched.secondaryKeywords.length} keywords ·{" "}
                  {watched.pixeltecExperience.length} experiencias ·{" "}
                  {watched.sources.length} fuentes ·{" "}
                  {watched.internalLinkTargets.length} enlaces internos
                </dd>
              </div>
            </dl>

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
          </div>
        </form>
      </Form>
    </div>
  );
}
