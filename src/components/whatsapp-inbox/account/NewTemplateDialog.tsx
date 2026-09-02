"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { TemplateCategory, TemplateLanguage } from "@/lib/whatsapp/management-types";
import { bodyVariables } from "./meta";

const BODY_MAX = 1024;
const FOOTER_MAX = 60;
const NAME_PATTERN = /^[a-z0-9_]{1,512}$/;

const LANGUAGES: { value: TemplateLanguage; label: string }[] = [
  { value: "es_MX", label: "Español (México)" },
  { value: "es", label: "Español" },
  { value: "en_US", label: "Inglés (EE. UU.)" },
  { value: "en", label: "Inglés" },
];

const CATEGORIES: { value: TemplateCategory; label: string; hint: string }[] = [
  { value: "UTILITY", label: "Utilidad", hint: "Avisos de una operación en curso: pedidos, citas, tickets." },
  { value: "MARKETING", label: "Marketing", hint: "Promociones y novedades. Requiere consentimiento del cliente." },
];

/** Mismo aspecto que `Input`, pero con `<select>` nativo: menos superficie y navegable con teclado en cualquier entorno. */
const SELECT_CLASS =
  "flex h-11 w-full rounded-xl border border-border/60 bg-secondary/40 px-3.5 py-2 text-sm text-foreground ring-offset-background transition-colors focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

interface NewTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** La plantilla se creó: el llamador refetchea la lista. */
  onCreated: () => void;
}

/**
 * Alta de plantilla — **la acción que Meta exige ver funcionando** para
 * aprobar `whatsapp_business_management`.
 *
 * Dos decisiones que vienen del contrato del backend:
 *
 *  1. La validación del cliente es un espejo *parcial* del builder puro del
 *     servidor. No pretende sustituirlo (la autoridad es `/templates`): existe
 *     para que el revisor no descubra un error tras un viaje a Meta.
 *  2. El 400 `invalid_template` trae `details[]` con **todos** los errores, y
 *     se pintan todos: un diálogo que corrige un campo por intento no se
 *     puede grabar en un screencast.
 */
export function NewTemplateDialog({ open, onOpenChange, onCreated }: NewTemplateDialogProps) {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<TemplateLanguage>("es_MX");
  const [category, setCategory] = useState<TemplateCategory>("UTILITY");
  const [body, setBody] = useState("");
  const [footer, setFooter] = useState("");
  const [examples, setExamples] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const variables = useMemo(() => bodyVariables(body), [body]);
  const categoryHint = CATEGORIES.find((c) => c.value === category)?.hint ?? "";

  function reset() {
    setName("");
    setLanguage("es_MX");
    setCategory("UTILITY");
    setBody("");
    setFooter("");
    setExamples({});
    setErrors([]);
  }

  function validate(): string[] {
    const found: string[] = [];
    if (!NAME_PATTERN.test(name.trim())) {
      found.push("El nombre solo admite minúsculas, números y guion bajo (sin espacios ni acentos).");
    }
    if (!body.trim()) found.push("El cuerpo no puede estar vacío.");
    if (body.length > BODY_MAX) found.push(`El cuerpo excede ${BODY_MAX} caracteres.`);
    // Meta numera las variables desde {{1}} y sin huecos: {{1}}, {{3}} se rechaza.
    variables.forEach((n, index) => {
      if (n !== index + 1) found.push(`Las variables deben ir de {{1}} en adelante y sin saltos (falta {{${index + 1}}}).`);
    });
    for (const n of variables) {
      if (!(examples[n] ?? "").trim()) found.push(`Falta el ejemplo de la variable {{${n}}}.`);
    }
    if (footer.length > FOOTER_MAX) found.push(`El pie excede ${FOOTER_MAX} caracteres.`);
    return found;
  }

  async function submit() {
    if (submitting) return;
    const clientErrors = validate();
    if (clientErrors.length > 0) {
      setErrors(clientErrors);
      return;
    }

    setSubmitting(true);
    setErrors([]);
    try {
      const res = await fetch("/api/whatsapp-inbox/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          language,
          category,
          body,
          examples: variables.map((n) => (examples[n] ?? "").trim()),
          ...(footer.trim() ? { footer: footer.trim() } : {}),
        }),
      });
      const data = (await res.json()) as { error?: string; details?: string[] };
      if (!res.ok) {
        setErrors(data.details ?? [data.error ?? `HTTP ${res.status}`]);
        return;
      }
      toast.success("Plantilla enviada a revisión de Meta");
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "No se pudo crear la plantilla."]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto p-5 sm:p-7">
        <DialogHeader>
          <DialogTitle>Nueva plantilla</DialogTitle>
          <DialogDescription>
            Meta revisa cada plantilla antes de habilitarla. Suele tardar unos minutos.
          </DialogDescription>
        </DialogHeader>

        {errors.length > 0 && (
          <ul
            role="alert"
            className="space-y-1 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-700 dark:text-red-300"
          >
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="template-name">Nombre</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="confirmacion_de_cita"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">Minúsculas, números y guion bajo. Ej. `confirmacion_de_cita`.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="template-language">Idioma</Label>
              <select
                id="template-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as TemplateLanguage)}
                className={SELECT_CLASS}
              >
                {LANGUAGES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="template-category">Categoría</Label>
              <select
                id="template-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                className={SELECT_CLASS}
              >
                {CATEGORIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">{categoryHint}</p>

          <div className="space-y-1.5">
            <Label htmlFor="template-body">Cuerpo</Label>
            <Textarea
              id="template-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              maxLength={BODY_MAX}
              placeholder="Hola {{1}}, tu cita quedó confirmada para el {{2}}."
              className="border-border/60 bg-secondary/40"
            />
            <p
              className={cn(
                "text-right text-xs",
                body.length > BODY_MAX ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
              )}
            >
              {body.length}/{BODY_MAX}
            </p>
          </div>

          {variables.length > 0 && (
            <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
              <p className="text-xs text-muted-foreground">
                Meta exige un ejemplo por cada variable del cuerpo.
              </p>
              {variables.map((n) => (
                <div key={n} className="space-y-1.5">
                  <Label htmlFor={`template-example-${n}`}>{`Ejemplo para {{${n}}}`}</Label>
                  <Input
                    id={`template-example-${n}`}
                    value={examples[n] ?? ""}
                    onChange={(e) => setExamples((prev) => ({ ...prev, [n]: e.target.value }))}
                    autoComplete="off"
                    className="h-9"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="template-footer">Pie (opcional)</Label>
            <Input
              id="template-footer"
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              maxLength={FOOTER_MAX}
              placeholder="PixelTEC"
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-secondary/40 px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white transition-colors hover:bg-cyan-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && <Spinner size="sm" />}
            Crear
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
