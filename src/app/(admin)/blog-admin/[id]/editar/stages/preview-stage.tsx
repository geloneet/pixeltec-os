"use client";

import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Monitor, Smartphone } from "lucide-react";
import type { BlogPostEditInput } from "@/lib/blog/schemas";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PreviewPanel } from "../preview-panel";

type Viewport = "desktop" | "mobile";

interface PreviewStageProps {
  form: UseFormReturn<BlogPostEditInput>;
  slug: string;
}

/** Etapa 4 — Vista previa: SERP + OG + artículo renderizado, con toggle
 *  Escritorio/Móvil (móvil = contenedor de 390px) — dictamen UX §3. */
export function PreviewStage({ form, slug }: PreviewStageProps) {
  const [viewport, setViewport] = useState<Viewport>("desktop");

  const watchedTitle = form.watch("title");
  const watchedExcerpt = form.watch("excerpt");
  const watchedBody = form.watch("body");
  const watchedCoverImage = form.watch("coverImage");
  const watchedSeoMetaTitle = form.watch("seoMetaTitle") ?? "";
  const watchedSeoMetaDescription = form.watch("seoMetaDescription") ?? "";
  const watchedCoverImageAlt = form.watch("coverImageAlt") ?? "";

  const toggleClass = (active: boolean) =>
    cn(
      "border-border",
      active
        ? "bg-secondary text-foreground"
        : "bg-transparent text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
    );

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={viewport === "desktop"}
          onClick={() => setViewport("desktop")}
          className={toggleClass(viewport === "desktop")}
        >
          <Monitor className="mr-2 h-3.5 w-3.5" />
          Escritorio
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={viewport === "mobile"}
          onClick={() => setViewport("mobile")}
          className={toggleClass(viewport === "mobile")}
        >
          <Smartphone className="mr-2 h-3.5 w-3.5" />
          Móvil
        </Button>
      </div>

      <div className={cn(viewport === "mobile" && "max-w-[390px] mx-auto")}>
        <PreviewPanel
          title={watchedTitle}
          excerpt={watchedExcerpt}
          body={watchedBody}
          slug={slug}
          coverImage={watchedCoverImage ?? null}
          coverImageAlt={watchedCoverImageAlt}
          metaTitle={watchedSeoMetaTitle}
          metaDescription={watchedSeoMetaDescription}
        />
      </div>
    </div>
  );
}
