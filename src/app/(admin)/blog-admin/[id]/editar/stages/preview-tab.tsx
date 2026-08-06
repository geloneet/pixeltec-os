"use client";

import type { UseFormReturn } from "react-hook-form";
import type { BlogPostEditInput } from "@/lib/blog/schemas";
import { PreviewPanel } from "../preview-panel";

interface PreviewTabProps {
  form: UseFormReturn<BlogPostEditInput>;
  slug: string;
}

export function PreviewTab({ form, slug }: PreviewTabProps) {
  const watchedTitle = form.watch("title");
  const watchedExcerpt = form.watch("excerpt");
  const watchedBody = form.watch("body");
  const watchedCoverImage = form.watch("coverImage");
  const watchedSeoMetaTitle = form.watch("seoMetaTitle") ?? "";
  const watchedSeoMetaDescription = form.watch("seoMetaDescription") ?? "";
  const watchedCoverImageAlt = form.watch("coverImageAlt") ?? "";

  return (
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
  );
}
