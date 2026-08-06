"use client";

import type { UseFormReturn } from "react-hook-form";
import type { BlogPostEditInput } from "@/lib/blog/schemas";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { SeoPanel } from "../seo-panel";
import { InternalLinksEditor } from "../internal-links-editor";
import { SlugCard } from "../slug-card";

interface OptimizarStageProps {
  form: UseFormReturn<BlogPostEditInput>;
  postId: string;
  slug: string;
  isPublished: boolean;
  onSlugChanged: (newSlug: string) => void;
}

/** Etapa 2 — Optimizar: SEO, enlaces internos y slug (dictamen UX
 *  2026-08-05 §3). El card de slug conserva su diálogo y aviso de redirect. */
export function OptimizarStage({
  form,
  postId,
  slug,
  isPublished,
  onSlugChanged,
}: OptimizarStageProps) {
  return (
    <div className="space-y-6">
      {/* id=anchor-*: destinos de los deep-links del panel de publicación (B-PR4). */}
      <div id="anchor-seo">
        <SeoPanel form={form} />
      </div>

      {/* Enlaces internos */}
      <div id="anchor-internal-links">
        <FormField
          control={form.control}
          name="internalLinks"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <InternalLinksEditor value={field.value ?? []} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Slug (antes en el sidebar) */}
      <div id="anchor-slug">
        <SlugCard
          postId={postId}
          slug={slug}
          isPublished={isPublished}
          onSlugChanged={onSlugChanged}
        />
      </div>
    </div>
  );
}
