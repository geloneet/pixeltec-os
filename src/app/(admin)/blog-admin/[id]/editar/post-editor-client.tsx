"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Check, CircleAlert } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import {
  updatePost,
  setPostStatus,
  approvePost,
  publishPost,
  archivePost,
  getPublicationReadiness,
} from "@/lib/blog/actions/posts";
import { regenerateDraft } from "@/lib/blog/actions/drafts";
import { BlogPostEditSchema, type BlogPostEditInput } from "@/lib/blog/schemas";
import type { BlogPostSerialized, BlogPostStatus, BlogCategory } from "@/lib/blog/types";
import type { PublicationVerdict } from "@/lib/blog/publication-gate";
import { cn } from "@/lib/utils";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TagInput } from "./tag-input";
import { SeoPanel } from "./seo-panel";
import { SourcesEditor } from "./sources-editor";
import { InternalLinksEditor } from "./internal-links-editor";
import { EditorialPanel } from "./editorial-panel";
import { ReadinessPanel } from "./readiness-panel";
import { PreviewPanel } from "./preview-panel";
import { SlugCard } from "./slug-card";

// ─── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: { value: BlogCategory; label: string }[] = [
  { value: "arquitectura", label: "Arquitectura" },
  { value: "automatización", label: "Automatización" },
  { value: "case-study", label: "Case Study" },
  { value: "opinión", label: "Opinión" },
];

const STATUS_LABEL: Record<BlogPostStatus, string> = {
  draft: "Borrador",
  "needs-review": "En revisión",
  approved: "Aprobado",
  published: "Publicado",
  archived: "Archivado",
};

const STATUS_CLASS: Record<BlogPostStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  "needs-review": "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
  approved: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  published: "bg-green-500/20 text-green-700 dark:text-green-300",
  archived: "bg-muted text-muted-foreground",
};

const AUTO_SAVE_DEBOUNCE_MS = 5000;

type SaveStatus = "idle" | "saving" | "saved" | "error";

// ─── Main Component ────────────────────────────────────────────────────────────

interface PostEditorClientProps {
  post: BlogPostSerialized;
}

export function PostEditorClient({ post }: PostEditorClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [postStatus, setCurrentStatus] = useState<BlogPostStatus>(post.status);
  const [slug, setSlug] = useState(post.slug);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [coverError, setCoverError] = useState(false);
  const [verdict, setVerdict] = useState<PublicationVerdict | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(true);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<BlogPostEditInput>({
    resolver: zodResolver(BlogPostEditSchema),
    defaultValues: {
      title: post.title,
      excerpt: post.excerpt,
      body: post.body,
      category: post.category,
      tags: post.tags,
      coverImage: post.coverImage ?? null,
      seoMetaTitle: post.seo.metaTitle,
      seoMetaDescription: post.seo.metaDescription,
      // WS2 — SEO
      coverImageAlt: post.seo.ogImageAlt ?? "",
      canonicalUrl: post.seo.canonicalUrl ?? null,
      noindex: post.seo.noindex ?? true,
      primaryKeyword: post.seo.primaryKeyword ?? "",
      secondaryKeywords: post.seo.secondaryKeywords ?? [],
      searchIntent: post.seo.searchIntent ?? "",
      contentPillar: post.seo.contentPillar ?? "",
      // WS2 — evidencia y enlaces
      sources: post.sources ?? [],
      internalLinks: post.internalLinks ?? [],
      // WS2 — editorial
      reviewerId: post.editorial.reviewerId,
      nextReviewAt: post.editorial.nextReviewAt,
      aiDisclosure: post.editorial.aiDisclosure,
      claimsVerified: post.editorial.claimsVerified ?? false,
      sourcesVerified: post.editorial.sourcesVerified ?? false,
    },
  });

  const watchedTitle = form.watch("title");
  const watchedExcerpt = form.watch("excerpt");
  const watchedBody = form.watch("body");
  const watchedCoverImage = form.watch("coverImage");
  const watchedSeoMetaTitle = form.watch("seoMetaTitle") ?? "";
  const watchedSeoMetaDescription = form.watch("seoMetaDescription") ?? "";
  const watchedCoverImageAlt = form.watch("coverImageAlt") ?? "";

  useEffect(() => {
    setCoverError(false);
  }, [watchedCoverImage]);

  // ── Readiness (gate de publicación en servidor) ──────────────────────────────
  const refreshReadiness = useCallback(async () => {
    setReadinessLoading(true);
    try {
      const result = await getPublicationReadiness(post.id);
      if (result.ok && result.data) setVerdict(result.data);
    } finally {
      setReadinessLoading(false);
    }
  }, [post.id]);

  useEffect(() => {
    void refreshReadiness();
  }, [refreshReadiness]);

  // ── Auto-save ────────────────────────────────────────────────────────────────
  const runAutoSave = useCallback(async () => {
    const data = form.getValues();
    const parsed = BlogPostEditSchema.safeParse(data);
    if (!parsed.success) {
      // El fallo de validación NUNCA es silencioso: se muestra qué campo falla.
      const issue = parsed.error.errors[0];
      setSaveStatus("error");
      setSaveError(
        issue
          ? `No se guardó — ${issue.path.join(".") || "formulario"}: ${issue.message}`
          : "No se guardó: datos inválidos",
      );
      return;
    }

    setSaveStatus("saving");
    setSaveError(null);
    const result = await updatePost(post.id, parsed.data);
    if (result.ok) {
      setSaveStatus("saved");
      // El servidor mueve todo post no publicado a "needs-review" al guardar.
      setCurrentStatus((prev) => (prev === "published" ? prev : "needs-review"));
      setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 3000);
      void refreshReadiness();
    } else {
      setSaveStatus("error");
      setSaveError(result.error ?? "Error al guardar");
    }
  }, [form, post.id, refreshReadiness]);

  // Suscripción a TODOS los campos (antes solo title/excerpt/body): cualquier
  // cambio — tags, SEO, fuentes, enlaces, editorial — reinicia el debounce.
  useEffect(() => {
    const subscription = form.watch(() => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        void runAutoSave();
      }, AUTO_SAVE_DEBOUNCE_MS);
    });
    return () => {
      subscription.unsubscribe();
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [form, runAutoSave]);

  // Compute stats
  const wordCount = watchedBody
    ? watchedBody.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  const hasBlockers = (verdict?.blockers.length ?? 0) > 0;

  function handleSaveDraft() {
    startTransition(async () => {
      const data = form.getValues();
      const parsed = BlogPostEditSchema.safeParse(data);
      if (!parsed.success) {
        const issue = parsed.error.errors[0];
        const message = issue
          ? `${issue.path.join(".") || "formulario"}: ${issue.message}`
          : "Datos inválidos";
        setSaveStatus("error");
        setSaveError(message);
        toast.error(`No se pudo guardar — ${message}`);
        return;
      }
      const result = await updatePost(post.id, parsed.data);
      if (result.ok) {
        toast.success("Borrador guardado");
        setSaveStatus("saved");
        setSaveError(null);
        setCurrentStatus((prev) => (prev === "published" ? prev : "needs-review"));
        setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 3000);
        void refreshReadiness();
      } else {
        setSaveStatus("error");
        setSaveError(result.error ?? "Error al guardar");
        toast.error(result.error ?? "Error al guardar");
      }
    });
  }

  function handleMarkReview() {
    startTransition(async () => {
      const result = await setPostStatus(post.id, "needs-review");
      if (result.ok) {
        setCurrentStatus("needs-review");
        toast.success("Marcado para revisión");
        void refreshReadiness();
      } else {
        toast.error(result.error ?? "Error");
      }
    });
  }

  function handleApprove() {
    startTransition(async () => {
      const result = await approvePost(post.id);
      if (result.ok) {
        setCurrentStatus("approved");
        toast.success("Post aprobado");
        void refreshReadiness();
      } else {
        toast.error(result.error ?? "Error al aprobar");
      }
    });
  }

  function handlePublish() {
    startTransition(async () => {
      const result = await publishPost(post.id);
      if (result.ok) {
        toast.success("¡Post publicado!");
        router.push("/blog-admin");
      } else {
        // El gate en servidor devuelve el veredicto: se refleja en el panel.
        if (result.data) setVerdict(result.data);
        toast.error(result.error ?? "Error al publicar");
      }
    });
  }

  function handleRegenerate() {
    startTransition(async () => {
      const result = await regenerateDraft(post.id);
      if (result.ok) {
        toast.success("Borrador regenerado. Recargando…");
        router.refresh();
      } else {
        toast.error(result.error ?? "Error al regenerar");
      }
    });
  }

  function handleArchive() {
    setArchiveOpen(true);
  }

  function executeArchive() {
    startTransition(async () => {
      const result = await archivePost(post.id);
      if (result.ok) {
        toast.success("Post archivado");
        router.push("/blog-admin");
      } else {
        toast.error(result.error ?? "Error al archivar");
      }
    });
  }

  function handleSlugChanged(newSlug: string) {
    setSlug(newSlug);
    void refreshReadiness();
  }

  return (
    <>
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent className="border-border bg-background text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">¿Archivar este post?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              El post será retirado de la lista activa. Puedes restaurarlo más tarde cambiando su estado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border bg-secondary/50 text-foreground hover:bg-secondary">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeArchive}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              Archivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Form {...form}>
      <form className="grid grid-cols-1 gap-6 pb-16 lg:grid-cols-3">
        {/* ── Main editor (2/3) ── */}
        <div className="space-y-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-foreground">Editar post</h1>
            {/* Save status indicator */}
            <span className="text-xs text-muted-foreground">
              {saveStatus === "saving" && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Spinner size="sm" />
                  Guardando…
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="flex items-center gap-1 text-green-400">
                  <Check className="h-3 w-3" />
                  Guardado ✓
                </span>
              )}
              {saveStatus === "error" && (
                <span className="flex max-w-md items-center gap-1 text-red-400">
                  <CircleAlert className="h-3 w-3 shrink-0" />
                  <span className="truncate">{saveError ?? "Error al guardar"}</span>
                </span>
              )}
            </span>
          </div>

          <Tabs defaultValue="contenido">
            <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1">
              <TabsTrigger value="contenido">Contenido</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
              <TabsTrigger value="evidencia">Evidencia</TabsTrigger>
              <TabsTrigger value="enlaces">Enlaces internos</TabsTrigger>
              <TabsTrigger value="editorial">Editorial</TabsTrigger>
              <TabsTrigger value="preview">Vista previa</TabsTrigger>
            </TabsList>

            {/* ── Tab: Contenido ── */}
            <TabsContent value="contenido" className="space-y-5">
              {/* Cover Image */}
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
                    {watchedCoverImage && !coverError && (
                      <div className="relative mt-2 h-40 w-full overflow-hidden rounded-lg border border-border">
                        <Image
                          src={watchedCoverImage}
                          alt="Cover preview"
                          fill
                          className="object-cover"
                          onError={() => setCoverError(true)}
                        />
                      </div>
                    )}
                    {watchedCoverImage && coverError && (
                      <p className="mt-1 text-xs text-red-400">No se pudo cargar la imagen. Verifica la URL.</p>
                    )}
                  </FormItem>
                )}
              />

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
            </TabsContent>

            {/* ── Tab: SEO ── */}
            <TabsContent value="seo">
              <SeoPanel form={form} />
            </TabsContent>

            {/* ── Tab: Evidencia (fuentes) ── */}
            <TabsContent value="evidencia">
              <FormField
                control={form.control}
                name="sources"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <SourcesEditor value={field.value ?? []} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>

            {/* ── Tab: Enlaces internos ── */}
            <TabsContent value="enlaces">
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
            </TabsContent>

            {/* ── Tab: Editorial ── */}
            <TabsContent value="editorial">
              <EditorialPanel form={form} />
            </TabsContent>

            {/* ── Tab: Vista previa ── */}
            <TabsContent value="preview">
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
            </TabsContent>
          </Tabs>
        </div>

        {/* ── Sidebar (1/3) ── */}
        <div className="space-y-4">
          {/* Stats card */}
          <section className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Estadísticas
            </h3>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Palabras</span>
              <span className="font-medium text-foreground">
                {new Intl.NumberFormat("es-MX").format(wordCount)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Lectura</span>
              <span className="font-medium text-foreground">
                ~{readingTime} min
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Estado</span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                  STATUS_CLASS[postStatus],
                )}
              >
                {STATUS_LABEL[postStatus]}
              </span>
            </div>
          </section>

          {/* Readiness (gate de publicación) */}
          <ReadinessPanel verdict={verdict} loading={readinessLoading} />

          {/* Slug */}
          <SlugCard
            postId={post.id}
            slug={slug}
            isPublished={postStatus === "published"}
            onSlugChanged={handleSlugChanged}
          />

          {/* Actions card */}
          <section className="rounded-xl border border-border bg-card p-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Acciones
            </h3>

            {/* Save draft */}
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isPending}
              className="w-full border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 disabled:opacity-50"
            >
              {isPending ? (
                <Spinner size="sm" className="mr-2" />
              ) : saveStatus === "saved" ? (
                <Check className="mr-2 h-4 w-4" />
              ) : null}
              {saveStatus === "saved" ? "Guardado ✓" : "Guardar borrador"}
            </Button>

            {/* Mark for review */}
            <Button
              type="button"
              variant="outline"
              onClick={handleMarkReview}
              disabled={isPending || postStatus === "needs-review"}
              className="w-full border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 hover:text-yellow-300 disabled:opacity-40"
            >
              Marcar para revisión
            </Button>

            {/* Approve */}
            <Button
              type="button"
              onClick={handleApprove}
              disabled={isPending || postStatus === "approved" || postStatus === "published"}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40"
            >
              Aprobar
            </Button>

            {/* Publish — only if approved; disabled while the gate reports blockers */}
            {postStatus === "approved" && (
              <div className="space-y-1">
                <Button
                  type="button"
                  onClick={handlePublish}
                  disabled={isPending || hasBlockers}
                  className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold disabled:opacity-50"
                >
                  {isPending ? (
                    <Spinner size="sm" className="mr-2" />
                  ) : null}
                  Publicar
                </Button>
                {hasBlockers && (
                  <p className="text-xs text-red-400">
                    Hay bloqueos activos — revisa el panel de publicación.
                  </p>
                )}
              </div>
            )}

            <div className="border-t border-border pt-2 space-y-2">
              {/* Regenerate */}
              <Button
                type="button"
                variant="outline"
                onClick={handleRegenerate}
                disabled={isPending}
                className="w-full border-border text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40"
              >
                {isPending ? (
                  <Spinner size="sm" className="mr-2" />
                ) : null}
                Regenerar con IA
              </Button>

              {/* Archive */}
              <Button
                type="button"
                variant="outline"
                onClick={handleArchive}
                disabled={isPending}
                className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
              >
                Archivar
              </Button>
            </div>
          </section>
        </div>
      </form>
    </Form>
    </>
  );
}
