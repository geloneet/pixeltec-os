"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { BotExample } from "@/types/whatsapp-inbox";

const CUSTOMER_MSG_MAX = 500;
const IDEAL_REPLY_MAX = 1000;
const PRIORITY_MIN = 0;
const PRIORITY_MAX = 20;

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function extractErrorMessage(data: { error?: string; detail?: string }, status: number): string {
  return data.error ?? data.detail ?? `HTTP ${status}`;
}

interface FormState {
  customerMsg: string;
  idealReply: string;
  category: string;
  intent: string;
  priority: number;
}

const EMPTY_FORM: FormState = { customerMsg: "", idealReply: "", category: "", intent: "", priority: 0 };

/**
 * Biblioteca de ejemplos few-shot de PixelBot (Fase A / ADR-001). Lista +
 * formulario de alta + toggle activo/inactivo. Mismo patrón que BotConfigView:
 * fetch directo a las rutas proxy /api/whatsapp-inbox/examples*.
 */
export function ExamplesView() {
  const [examples, setExamples] = useState<BotExample[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

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
    if (!Number.isInteger(form.priority) || form.priority < PRIORITY_MIN || form.priority > PRIORITY_MAX) {
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
          manual_priority: form.priority,
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
          manual_priority: form.priority,
          active: true,
          created_at: new Date().toISOString(),
          created_by: "",
        },
        ...prev,
      ]);
      setForm(EMPTY_FORM);
      toast.success("Ejemplo agregado");
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

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center">
        <Spinner size="md" className="text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">No se pudieron cargar los ejemplos.</p>
        <p className="max-w-md text-xs text-muted-foreground/60">{error}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loadExamples()}
          className="border-border bg-secondary/40 text-xs text-muted-foreground hover:bg-secondary/60"
        >
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="scrollbar-soft min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pb-6">
      <SectionCard title="Nuevo ejemplo">
        <div className="space-y-1.5">
          <Textarea
            value={form.customerMsg}
            onChange={(e) => setForm((f) => ({ ...f, customerMsg: e.target.value }))}
            placeholder="Mensaje del cliente…"
            maxLength={CUSTOMER_MSG_MAX}
            className="min-h-[60px] border-border bg-secondary/40 text-sm text-foreground"
          />
        </div>
        <div className="space-y-1.5">
          <Textarea
            value={form.idealReply}
            onChange={(e) => setForm((f) => ({ ...f, idealReply: e.target.value }))}
            placeholder="Respuesta ideal…"
            maxLength={IDEAL_REPLY_MAX}
            className="min-h-[60px] border-border bg-secondary/40 text-sm text-foreground"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            placeholder="Categoría (opcional)"
            className="h-8 w-40 border-border bg-secondary/40 text-sm text-foreground"
          />
          <Input
            value={form.intent}
            onChange={(e) => setForm((f) => ({ ...f, intent: e.target.value }))}
            placeholder="Intención (opcional)"
            className="h-8 w-40 border-border bg-secondary/40 text-sm text-foreground"
          />
          <Input
            type="number"
            min={PRIORITY_MIN}
            max={PRIORITY_MAX}
            value={form.priority}
            onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
            aria-label="Prioridad manual"
            className="h-8 w-24 border-border bg-secondary/40 text-sm text-foreground"
          />
        </div>
        <Button
          type="button"
          onClick={() => void handleCreate()}
          disabled={submitting}
          className="h-8 bg-cyan-600 text-xs text-white hover:bg-cyan-500"
        >
          {submitting && <Spinner size="sm" />}
          Agregar ejemplo
        </Button>
      </SectionCard>

      <div className="space-y-2">
        {examples.length === 0 && (
          <p className="text-xs text-muted-foreground/60">Sin ejemplos todavía.</p>
        )}
        {examples.map((example) => (
          <div key={example.id} className="space-y-2 rounded-xl border border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xs text-muted-foreground">{example.customer_msg}</p>
                <p className="text-sm text-foreground">{example.ideal_reply}</p>
              </div>
              <Switch checked={example.active} onCheckedChange={() => void handleToggleActive(example)} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {example.category && (
                <Badge variant="outline" className="border-border bg-muted text-[11px] font-normal text-muted-foreground">
                  {example.category}
                </Badge>
              )}
              {example.intent && (
                <Badge variant="outline" className="border-border bg-muted text-[11px] font-normal text-muted-foreground">
                  {example.intent}
                </Badge>
              )}
              {example.manual_priority > 0 && (
                <Badge
                  variant="outline"
                  className="border-cyan-500/30 bg-cyan-500/10 text-[11px] font-normal text-cyan-700 dark:text-cyan-300"
                >
                  prioridad {example.manual_priority}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
