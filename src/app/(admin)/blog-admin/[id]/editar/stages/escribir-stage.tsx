"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import type { UseFormReturn } from "react-hook-form";
import type { BlogPostEditInput } from "@/lib/blog/schemas";
import type { BlogCategory } from "@/lib/blog/types";
import type { UnsplashPhoto } from "@/lib/unsplash-egress";
import { cn } from "@/lib/utils";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagInput } from "../../../tag-input";
import { UnsplashPicker } from "../unsplash-picker";

const CATEGORY_OPTIONS: { value: BlogCategory; label: string }[] = [
  { value: "arquitectura", label: "Arquitectura" },
  { value: "automatización", label: "Automatización" },
  { value: "case-study", label: "Case Study" },
  { value: "opinión", label: "Opinión" },
];

interface EscribirStageProps {
  form: UseFormReturn<BlogPostEditInput>;
  onUnsplashSelect: (photo: UnsplashPhoto, searchQuery: string) => void;
}

/** Etapa 1 — Escribir: portada, título, extracto, cuerpo, categoría y
 *  etiquetas (dictamen UX 2026-08-05 §3). La portada se elige visualmente
 *  (UnsplashPicker); la URL cruda queda en «Opciones avanzadas». */
export function EscribirStage({ form, onUnsplashSelect }: EscribirStageProps) {
  const watchedCoverImage = form.watch("coverImage");
  const [coverError, setCoverError] = useState(false);

  useEffect(() => {
    setCoverError(false);
  }, [watchedCoverImage]);

  return (
    <div className="space-y-5">
      {/* ── Portada ── */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Portada
          </h3>
          <UnsplashPicker onSelect={onUnsplashSelect} triggerLabel="Cambiar imagen" />
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

      {/* Excerpt */}
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

      {/* Body */}
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
  );
}
