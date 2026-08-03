"use client";

import { useEffect, useMemo, useState } from "react";
import { GraduationCap, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { BotExample } from "@/types/whatsapp-inbox";
import { EmptyState } from "./ui/EmptyState";
import { extractErrorMessage, IMPORTANCE_LEVELS, importanceFromPriority, type ImportanceId } from "./ui/meta";

const CUSTOMER_MSG_MAX = 500;
const IDEAL_REPLY_MAX = 1000;
const PRIORITY_MIN = 0;
const PRIORITY_MAX = 20;

/** Sugerencias del estado vacío: dan la idea sin inventar contenido del negocio. */
const SUGGESTED_EXAMPLES = [
  "¿Cuánto cuesta el servicio? → cómo cotizas sin dar precio cerrado",
  "Quiero hablar con una persona → tu mensaje de transferencia",
  "¿Tienen horario de atención? → tu horario real",
];

interface FormState {
  customerMsg: string;
  idealReply: string;
  category: string;
  intent: string;
  importance: ImportanceId;
}

const EMPTY_FORM: FormState = { customerMsg: "", idealReply: "", category: "", intent: "", importance: "normal" };

type ActiveFilter = "todos" | "activos" | "inactivos";

/**
 * Entrenamiento del bot (§8.9, antes "Ejemplos"): biblioteca de respuestas
 * de referencia. Alta vía dialog con Importancia (Normal/Alta/Crítica) que
 * mapea internamente al entero manual_priority 0–20 del contrato — el número
 * exacto sigue visible en el tooltip del badge. Editar/eliminar/duplicar no
 * existen en la API de pixelbot: quedan en backlog P1, sin botones falsos.
 */
export function ExamplesView() {
  const [examples, setExamples] = useState<BotExample[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("todos");

  async function loadExamples() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/whatsapp-inbox/examples", { cache: "no-store" });
      const data = (await res.json()) as { examples?: BotExample[]; error?: string; detail?: string };
      if (!res.ok || !data.examples) {
        throw new Error(extractErrorMessage(data, res.status));
      }
      setExamples(data.examples);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadExamples();
  }, []);

  async function handleCreate() {
    if (submitting) return;
    const customerMsg = form.customerMsg.trim();
    const idealReply = form.idealReply.trim();
    if (!customerMsg || customerMsg.length > CUSTOMER_MSG_MAX) {
      toast.error(`El mensaje del cliente debe tener entre 1 y ${CUSTOMER_MSG_MAX} caracteres`);
      return;
    }
    if (!idealReply || idealReply.length > IDEAL_REPLY_MAX) {
      toast.error(`La respuesta ideal debe tener entre 1 y ${IDEAL_REPLY_MAX} caracteres`);
      return;
    }
    const level = IMPORTANCE_LEVELS.find((l) => l.id === form.importance) ?? IMPORTANCE_LEVELS[0];
    const priority = level.priority;
    if (!Number.isInteger(priority) || priority < PRIORITY_MIN || priority > PRIORITY_MAX) {
      toast.error(`La prioridad debe ser un entero entre ${PRIORITY_MIN} y ${PRIORITY_MAX}`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/whatsapp-inbox/examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_msg: customerMsg,
          ideal_reply: idealReply,
          category: form.category.trim() || null,
          intent: form.intent.trim() || null,
          manual_priority: priority,
          tags: [],
        }),
      });
      const data = (await res.json()) as { id?: number; error?: string; detail?: string };
      if (!res.ok || typeof data.id !== "number") {
        throw new Error(extractErrorMessage(data, res.status));
      }
      setExamples((prev) => [
        {
          id: data.id!,
          customer_msg: customerMsg,
          ideal_reply: idealReply,
          category: form.category.trim() || null,
          intent: form.intent.trim() || null,
          tags: [],
          manual_priority: priority,
          active: true,
          created_at: new Date().toISOString(),
          created_by: "",
        },
        ...prev,
      ]);
      setForm(EMPTY_FORM);
      setDialogOpen(false);
      toast.success("Ejemplo agregado — el bot lo usará como referencia");
    } catch (err) {
      toast.error(`No se pudo crear el ejemplo: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(example: BotExample) {
    const next = !example.active;
    // Optimista: el toggle se siente inmediato; revertimos si falla.
    setExamples((prev) => prev.map((e) => (e.id === example.id ? { ...e, active: next } : e)));
    try {
      const res = await fetch(`/api/whatsapp-inbox/examples/${example.id}/active`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      const data = (await res.json()) as { active?: boolean; error?: string; detail?: string };
      if (!res.ok) {
        throw new Error(extractErrorMessage(data, res.status));
      }
    } catch (err) {
      setExamples((prev) => prev.map((e) => (e.id === example.id ? { ...e, active: example.active } : e)));
      toast.error(`No se pudo actualizar: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const activeCount = examples.filter((e) => e.active).length;
  const q = search.trim().toLowerCase();

  const visibleExamples = useMemo(
    () =>
      examples.filter((e) => {
        if (activeFilter === "activos" && !e.active) return false;
        if (activeFilter === "inactivos" && e.active) return false;
        if (!q) return true;
        return [e.customer_msg, e.ideal_reply, e.category ?? "", e.intent ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(q);
      }),
    [examples, activeFilter, q]
  );

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center">
        <Spinner size="md" className="text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center p-8">
        <EmptyState
          icon={GraduationCap}
          tone="error"
          title="No pudimos cargar el entrenamiento"
          description={error}
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadExamples()}
              className="border-border bg-secondary/40 text-xs text-muted-foreground hover:bg-secondary/60"
            >
              Reintentar
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="scrollbar-soft min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl space-y-4 p-4 pb-6">
        {/* Header (§8.9) */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground">Entrenamiento</h2>
            <p className="text-xs text-muted-foreground">
              Enséñale al bot cómo debe responder en situaciones reales
            </p>
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {activeCount}/{examples.length} activos
          </span>
          <Button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="h-8 bg-cyan-600 text-xs text-white hover:bg-cyan-500"
          >
            <Plus aria-hidden className="h-3.5 w-3.5" />
            Nuevo ejemplo
          </Button>
        </div>

        {/* Búsqueda + filtro activo/inactivo */}
        {examples.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar ejemplo…"
                aria-label="Buscar en el entrenamiento"
                className="w-full rounded-lg border border-border bg-secondary/40 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-cyan-500/50 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/40 p-1">
              {(
                [
                  ["todos", "Todos"],
                  ["activos", "Activos"],
                  ["inactivos", "Inactivos"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={activeFilter === id}
                  onClick={() => setActiveFilter(id)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40",
                    activeFilter === id
                      ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Listado */}
        {examples.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="Tu bot todavía no tiene entrenamiento"
            description="Cada ejemplo le enseña al bot una situación real y la respuesta que esperas. Empieza con las preguntas que más te hacen tus clientes:"
            actions={
              <div className="space-y-2 text-left">
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {SUGGESTED_EXAMPLES.map((s) => (
                    <li key={s}>· {s}</li>
                  ))}
                </ul>
                <Button
                  type="button"
                  onClick={() => setDialogOpen(true)}
                  className="h-8 w-full bg-cyan-600 text-xs text-white hover:bg-cyan-500"
                >
                  <Plus aria-hidden className="h-3.5 w-3.5" />
                  Crear el primero
                </Button>
              </div>
            }
          />
        ) : visibleExamples.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            Ningún ejemplo coincide con la búsqueda o el filtro.
          </p>
        ) : (
          <div className="space-y-2">
            {visibleExamples.map((example) => {
              const importance = importanceFromPriority(example.manual_priority);
              return (
                <div
                  key={example.id}
                  className={cn(
                    "space-y-2 rounded-xl border border-border bg-card/40 p-3",
                    !example.active && "opacity-60"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs text-muted-foreground">{example.customer_msg}</p>
                      <p className="text-sm text-foreground">{example.ideal_reply}</p>
                    </div>
                    <label className="flex flex-shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      {example.active ? "Activo" : "Inactivo"}
                      <Switch
                        checked={example.active}
                        onCheckedChange={() => void handleToggleActive(example)}
                        aria-label={example.active ? "Desactivar ejemplo" : "Activar ejemplo"}
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {example.category && (
                      <Badge variant="outline" className="border-border bg-muted text-xs font-normal text-muted-foreground">
                        {example.category}
                      </Badge>
                    )}
                    {example.intent && (
                      <Badge variant="outline" className="border-border bg-muted text-xs font-normal text-muted-foreground">
                        {example.intent}
                      </Badge>
                    )}
                    {example.manual_priority > 0 && (
                      <Badge
                        variant="outline"
                        title={`Prioridad interna: ${example.manual_priority}`}
                        className="border-cyan-500/30 bg-cyan-500/10 text-xs font-normal text-cyan-700 dark:text-cyan-300"
                      >
                        Importancia: {importance.label}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog de alta (§8.9) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-border bg-card sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">Nuevo ejemplo</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Escribe la situación real y la respuesta que quieres que el bot aprenda.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="example-customer" className="text-xs font-medium text-muted-foreground">
                Mensaje del cliente
              </label>
              <Textarea
                id="example-customer"
                value={form.customerMsg}
                onChange={(e) => setForm((f) => ({ ...f, customerMsg: e.target.value }))}
                placeholder="Ej. ¿Cuánto cuesta una página web?"
                maxLength={CUSTOMER_MSG_MAX}
                className="min-h-[60px] border-border bg-secondary/40 text-sm text-foreground"
              />
              <p className="text-right text-xs text-muted-foreground/60">
                {form.customerMsg.length}/{CUSTOMER_MSG_MAX}
              </p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="example-reply" className="text-xs font-medium text-muted-foreground">
                Respuesta ideal
              </label>
              <Textarea
                id="example-reply"
                value={form.idealReply}
                onChange={(e) => setForm((f) => ({ ...f, idealReply: e.target.value }))}
                placeholder="La respuesta exacta que debería dar el bot…"
                maxLength={IDEAL_REPLY_MAX}
                className="min-h-[80px] border-border bg-secondary/40 text-sm text-foreground"
              />
              <p className="text-right text-xs text-muted-foreground/60">
                {form.idealReply.length}/{IDEAL_REPLY_MAX}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="Tema (opcional)"
                aria-label="Tema"
                className="h-8 w-40 border-border bg-secondary/40 text-sm text-foreground"
              />
              <Input
                value={form.intent}
                onChange={(e) => setForm((f) => ({ ...f, intent: e.target.value }))}
                placeholder="Intención (opcional)"
                aria-label="Intención"
                className="h-8 w-40 border-border bg-secondary/40 text-sm text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Importancia</p>
              <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Importancia del ejemplo">
                {IMPORTANCE_LEVELS.map((level) => (
                  <button
                    key={level.id}
                    type="button"
                    role="radio"
                    aria-checked={form.importance === level.id}
                    onClick={() => setForm((f) => ({ ...f, importance: level.id }))}
                    className={cn(
                      "rounded-md border px-2 py-2 text-left transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40",
                      form.importance === level.id
                        ? "border-cyan-500/40 bg-cyan-500/10"
                        : "border-border hover:bg-secondary/40"
                    )}
                  >
                    <p className={cn("text-xs font-medium", form.importance === level.id ? "text-cyan-700 dark:text-cyan-300" : "text-foreground")}>
                      {level.label}
                    </p>
                    <p className="text-[11px] leading-tight text-muted-foreground">{level.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDialogOpen(false)}
              className="h-8 text-xs text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreate()}
              disabled={submitting || !form.customerMsg.trim() || !form.idealReply.trim()}
              className="h-8 bg-cyan-600 text-xs text-white hover:bg-cyan-500"
            >
              {submitting && <Spinner size="sm" />}
              Agregar ejemplo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
