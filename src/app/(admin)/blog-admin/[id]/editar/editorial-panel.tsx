"use client";

import type { UseFormReturn } from "react-hook-form";
import type { BlogPostEditInput } from "@/lib/blog/schemas";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

interface EditorialPanelProps {
  form: UseFormReturn<BlogPostEditInput>;
}

export function EditorialPanel({ form }: EditorialPanelProps) {
  return (
    <div className="space-y-5">
      {/* Revisor */}
      <FormField
        control={form.control}
        name="reviewerId"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-muted-foreground">Revisor (opcional)</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value || null)}
                placeholder="ID o usuario del revisor asignado"
                className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Próxima revisión */}
      <FormField
        control={form.control}
        name="nextReviewAt"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-muted-foreground">Próxima revisión</FormLabel>
            <FormControl>
              <Input
                type="date"
                value={field.value ? field.value.slice(0, 10) : ""}
                onChange={(e) => field.onChange(e.target.value || null)}
                className="bg-background border-border text-foreground focus:border-blue-500/50"
              />
            </FormControl>
            <p className="text-xs text-muted-foreground">
              Fecha en la que el contenido debe volver a revisarse por vigencia.
            </p>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Divulgación de IA */}
      <FormField
        control={form.control}
        name="aiDisclosure"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-muted-foreground">Divulgación de IA</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value || null)}
                rows={2}
                maxLength={300}
                placeholder="ej. Borrador asistido por IA, revisado y editado por el equipo de PixelTEC."
                className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 resize-none"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Verificaciones humanas */}
      <FormField
        control={form.control}
        name="claimsVerified"
        render={({ field }) => (
          <FormItem className="rounded-lg border border-border p-3">
            <label className="flex cursor-pointer items-start gap-3">
              <FormControl>
                <Checkbox
                  checked={field.value ?? false}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  className="mt-0.5"
                />
              </FormControl>
              <span className="space-y-1">
                <span className="block text-sm font-medium text-foreground">
                  Afirmaciones verificadas
                </span>
                <span className="block text-xs text-muted-foreground">
                  Confirmo que las afirmaciones verificables del artículo fueron
                  contrastadas por un humano.
                </span>
              </span>
            </label>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="sourcesVerified"
        render={({ field }) => (
          <FormItem className="rounded-lg border border-border p-3">
            <label className="flex cursor-pointer items-start gap-3">
              <FormControl>
                <Checkbox
                  checked={field.value ?? false}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  className="mt-0.5"
                />
              </FormControl>
              <span className="space-y-1">
                <span className="block text-sm font-medium text-foreground">
                  Fuentes verificadas
                </span>
                <span className="block text-xs text-muted-foreground">
                  Confirmo que las fuentes citadas fueron revisadas y respaldan
                  lo que se afirma.
                </span>
              </span>
            </label>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
