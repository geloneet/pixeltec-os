"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronDown, Upload } from "lucide-react";
import { toast } from "sonner";
import type { UseFormReturn } from "react-hook-form";
import type { BlogPostEditInput } from "@/lib/blog/schemas";
import type { BlogCategory, BlogPostSerialized } from "@/lib/blog/types";
import type { UnsplashPhoto } from "@/lib/unsplash-egress";
import { cn } from "@/lib/utils";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TagInput } from "../../../tag-input";
import { UnsplashPicker } from "../unsplash-picker";

const CATEGORY_OPTIONS: { value: BlogCategory; label: string }[] = [
  { value: "arquitectura", label: "Arquitectura" },
  { value: "automatización", label: "Automatización" },
  { value: "case-study", label: "Case Study" },
  { value: "opinión", label: "Opinión" },
];

/** MIME aceptado por /api/blog/cover (sin SVG a propósito). */
const COVER_ACCEPT = "image/jpeg,image/png,image/webp";

interface EscribirStageProps {
  form: UseFormReturn<BlogPostEditInput>;
  postId: string;
  onUnsplashSelect: (photo: UnsplashPhoto, searchQuery: string) => void;
  /** B-PR7 — brief congelado del artículo (`brief_source`); {} en posts manuales. */
  briefSource?: BlogPostSerialized["briefSource"] | null;
}

/** Etapa 1 — Escribir: portada, título, extracto, cuerpo, categoría y
 *  etiquetas (dictamen UX 2026-08-05 §3). La portada se elige visualmente
 *  (UnsplashPicker) o se sube un archivo propio a R2 (B-PR5); la URL cruda
 *  queda en «Opciones avanzadas». B-PR7: panel «Origen (brief)» colapsado con
 *  el brief congelado, solo cuando el artículo nació de uno. */
export function EscribirStage({ form, postId, onUnsplashSelect, briefSource }: EscribirStageProps) {
  const hasBriefSource = Boolean(
    briefSource &&
      (briefSource.topic ||
        briefSource.angle ||
        briefSource.targetAudience ||
        (briefSource.keyPoints?.length ?? 0) > 0),
  );
  const watchedCoverImage = form.watch("coverImage");
  const [coverError, setCoverError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCoverError(false);
  }, [watchedCoverImage]);

  async function handleCoverFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset: permite re-seleccionar el mismo archivo tras un error.
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const body = new FormData();
      body.set("postId", postId);
      body.set("file", file);
      const res = await fetch("/api/blog/cover", { method: "POST", body });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; url?: string; error?: string } | null;
      if (!res.ok || !json?.ok || !json.url) {
        toast.error(json?.error ?? "No se pudo subir la portada");
        return;
      }
      form.setValue("coverImage", json.url, { shouldDirty: true });
      toast.success("Portada subida");
    } catch {
      toast.error("No se pudo subir la portada");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* ── Origen (brief) — B-PR7: el brief congelado que generó el artículo.
          Colapsado por defecto: es contexto de consulta, no un campo a editar. */}
      {hasBriefSource && briefSource && (
        <Collapsible>
          <section className="rounded-xl border border-border bg-card">
            <CollapsibleTrigger className="group flex w-full items-center justify-between p-4 text-left">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Origen (brief)
              </h3>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 px-4 pb-4 text-sm">
              {briefSource.topic && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Tema</p>
                  <p className="text-foreground">{briefSource.topic}</p>
                </div>
              )}
              {briefSource.angle && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Ángulo</p>
                  <p className="text-foreground">{briefSource.angle}</p>
                </div>
              )}
              {briefSource.targetAudience && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Audiencia</p>
                  <p className="text-foreground">{briefSource.targetAudience}</p>
                </div>
              )}
              {(briefSource.keyPoints?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Puntos clave</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-foreground">
                    {briefSource.keyPoints.map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CollapsibleContent>
          </section>
        </Collapsible>
      )}

      {/* ── Portada ── */}
      {/* id=anchor-*: destinos de los deep-links del panel de publicación (B-PR4). */}
      <section id="anchor-cover" className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Portada
          </h3>
          <div className="flex items-center gap-2">
            {/* Subida directa a R2 (B-PR5) */}
            <input
              ref={fileInputRef}
              type="file"
              accept={COVER_ACCEPT}
              className="hidden"
              onChange={handleCoverFile}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="border-border bg-secondary/50 text-foreground hover:bg-secondary"
            >
              {uploading ? <Spinner size="sm" className="mr-2" /> : <Upload className="mr-2 h-4 w-4" />}
              Subir archivo
            </Button>
            <UnsplashPicker onSelect={onUnsplashSelect} triggerLabel="Cambiar imagen" />
          </div>
        </div>

        {watchedCoverImage && !coverError ? (
          <div className="relative aspect-[1200/630] w-full overflow-hidden rounded-lg border border-border">
            <Image
              src={watchedCoverImage}
              alt="Vista previa de la portada"
              fill
              className="object-cover"
              onError={() => setCoverError(true)}
            />
          </div>
        ) : (
          <div className="flex aspect-[1200/630] w-full items-center justify-center rounded-lg border border-dashed border-border bg-secondary/30 px-4 text-center text-xs text-muted-foreground">
            {watchedCoverImage && coverError
              ? "No se pudo cargar la imagen. Verifica la URL en «Opciones avanzadas»."
              : "Sin portada — usa «Cambiar imagen» para elegir una."}
          </div>
        )}

        {/* Alt de portada (antes en SEO): vive junto a la imagen que describe. */}
        <FormField
          control={form.control}
          name="coverImageAlt"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-muted-foreground">Alt de la portada</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  maxLength={200}
                  placeholder="Descripción de la imagen de portada (accesibilidad y OG)"
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50"
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Si queda vacío se usará el título del post.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Atribución de la portada (B-PR5): crédito del autor/fuente. */}
        <FormField
          control={form.control}
          name="coverAttribution"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-muted-foreground">Atribución (opcional)</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  maxLength={200}
                  placeholder="Ej. Foto de Ana Pérez / archivo propio"
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <details>
          <summary className="cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground">
            Opciones avanzadas
          </summary>
          <div className="mt-3">
            <FormField
              control={form.control}
              name="coverImage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">Imagen de portada (URL)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50"
                      placeholder="https://images.unsplash.com/…"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </details>
      </section>

      {/* Title */}
      <div id="anchor-title">
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-muted-foreground">Título</FormLabel>
            <FormControl>
              <Input
                {...field}
                className="bg-background border-border text-foreground text-2xl font-bold placeholder:text-muted-foreground focus:border-blue-500/50 h-auto py-3"
                placeholder="Título del artículo"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      </div>

      {/* Excerpt */}
      <div id="anchor-excerpt">
      <FormField
        control={form.control}
        name="excerpt"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between">
              <FormLabel className="text-muted-foreground">Extracto</FormLabel>
              <span
                className={cn(
                  "text-xs",
                  (field.value?.length ?? 0) > 160
                    ? "text-red-400"
                    : "text-muted-foreground",
                )}
              >
                {field.value?.length ?? 0}/160
              </span>
            </div>
            <FormControl>
              <Textarea
                {...field}
                rows={2}
                maxLength={160}
                placeholder="Resumen del artículo para SEO y listados"
                className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 resize-none"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      </div>

      {/* Body */}
      <div id="anchor-body">
      <FormField
        control={form.control}
        name="body"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-muted-foreground">
              Cuerpo (Markdown)
            </FormLabel>
            <FormControl>
              <Textarea
                {...field}
                rows={24}
                placeholder="# Título&#10;&#10;Escribe el contenido en Markdown…"
                className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 resize-y font-mono text-sm"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      </div>

      {/* Category */}
      <FormField
        control={form.control}
        name="category"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-muted-foreground">Categoría</FormLabel>
            <Select
              onValueChange={field.onChange}
              defaultValue={field.value}
            >
              <FormControl>
                <SelectTrigger className="bg-background border-border text-foreground focus:border-blue-500/50">
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="border-border bg-popover/95 backdrop-blur-xl">
                {CATEGORY_OPTIONS.map((opt) => (
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

      {/* Tags */}
      <div id="anchor-tags">
      <FormField
        control={form.control}
        name="tags"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-muted-foreground">Etiquetas</FormLabel>
            <FormControl>
              <TagInput value={field.value} onChange={field.onChange} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      </div>
    </div>
  );
}
