"use client";

import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { BlogPostEditInput } from "@/lib/blog/schemas";
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
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TagInput } from "../../tag-input";

/** Sentinel para Radix Select (no admite value=""). */
const INTENT_NONE = "none";

const SEARCH_INTENT_OPTIONS: { value: string; label: string }[] = [
  { value: INTENT_NONE, label: "Sin definir" },
  { value: "informational", label: "Informacional" },
  { value: "commercial-investigation", label: "Investigación comercial" },
  { value: "transactional", label: "Transaccional" },
  { value: "navigational", label: "Navegacional" },
];

interface SeoPanelProps {
  form: UseFormReturn<BlogPostEditInput>;
}

export function SeoPanel({ form }: SeoPanelProps) {
  // La canonical se edita solo tras confirmación explícita: cambiarla altera
  // qué URL consolida la autoridad del artículo en buscadores.
  const [canonicalUnlocked, setCanonicalUnlocked] = useState(false);
  const [canonicalConfirmOpen, setCanonicalConfirmOpen] = useState(false);

  return (
    <div className="space-y-5">
      <AlertDialog open={canonicalConfirmOpen} onOpenChange={setCanonicalConfirmOpen}>
        <AlertDialogContent className="border-border bg-background text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              ¿Seguro? Esto cambia la URL canónica
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              La URL canónica le dice a Google cuál es la versión oficial de este
              contenido. Cambiarla puede transferir (o perder) el posicionamiento
              del artículo. Solo edítala si sabes exactamente por qué.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border bg-secondary/50 text-foreground hover:bg-secondary">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => setCanonicalUnlocked(true)}
              className="bg-blue-600 text-white hover:bg-blue-500"
            >
              Sí, editar canonical
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Meta título */}
      <FormField
        control={form.control}
        name="seoMetaTitle"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between">
              <FormLabel className="text-muted-foreground">Meta título</FormLabel>
              <span
                className={cn(
                  "text-xs",
                  (field.value?.length ?? 0) > 70 ? "text-red-400" : "text-muted-foreground",
                )}
              >
                {field.value?.length ?? 0}/70
              </span>
            </div>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ""}
                maxLength={70}
                placeholder="Meta título SEO"
                className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Meta descripción */}
      <FormField
        control={form.control}
        name="seoMetaDescription"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between">
              <FormLabel className="text-muted-foreground">Meta descripción</FormLabel>
              <span
                className={cn(
                  "text-xs",
                  (field.value?.length ?? 0) > 160 ? "text-red-400" : "text-muted-foreground",
                )}
              >
                {field.value?.length ?? 0}/160
              </span>
            </div>
            <FormControl>
              <Textarea
                {...field}
                value={field.value ?? ""}
                rows={3}
                maxLength={160}
                placeholder="Meta descripción SEO"
                className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 resize-none"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Keyword principal */}
      <FormField
        control={form.control}
        name="primaryKeyword"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-muted-foreground">Palabra clave principal</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ""}
                maxLength={120}
                placeholder="ej. automatización de procesos pyme"
                className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Keywords secundarias */}
      <FormField
        control={form.control}
        name="secondaryKeywords"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-muted-foreground">Palabras clave secundarias</FormLabel>
            <FormControl>
              <TagInput
                value={field.value ?? []}
                onChange={field.onChange}
                maxTags={10}
                placeholder="Agregar keyword…"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Intención de búsqueda */}
      <FormField
        control={form.control}
        name="searchIntent"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-muted-foreground">Intención de búsqueda</FormLabel>
            <Select
              onValueChange={(v) => field.onChange(v === INTENT_NONE ? "" : v)}
              value={field.value ? field.value : INTENT_NONE}
            >
              <FormControl>
                <SelectTrigger className="bg-background border-border text-foreground focus:border-blue-500/50">
                  <SelectValue placeholder="Sin definir" />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="border-border bg-popover/95 backdrop-blur-xl">
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
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Pilar de contenido */}
      <FormField
        control={form.control}
        name="contentPillar"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-muted-foreground">Pilar de contenido</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ""}
                maxLength={120}
                placeholder="ej. Automatización"
                className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* El alt de la portada vive en la etapa Escribir, junto a la imagen
          que describe (B-PR3) — mismo campo `coverImageAlt` del form. */}

      {/* Canonical URL — protegida por confirmación */}
      <FormField
        control={form.control}
        name="canonicalUrl"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-muted-foreground">URL canónica</FormLabel>
            <div className="flex gap-2">
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  disabled={!canonicalUnlocked}
                  placeholder="https://… (vacío = la URL propia del post)"
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 disabled:opacity-60"
                />
              </FormControl>
              {!canonicalUnlocked && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCanonicalConfirmOpen(true)}
                  className="shrink-0 border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  Editar
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Solo se edita tras confirmación: cambia qué URL consolida el
              posicionamiento del artículo.
            </p>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* noindex */}
      <FormField
        control={form.control}
        name="noindex"
        render={({ field }) => (
          <FormItem className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
            <div className="space-y-1">
              <FormLabel className="text-foreground">noindex</FormLabel>
              <p className="text-xs text-muted-foreground">
                Con noindex activo el artículo será visible en el sitio pero
                excluido de Google y otros buscadores. Al publicar, el servidor
                lo desactiva automáticamente.
              </p>
            </div>
            <FormControl>
              <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}
