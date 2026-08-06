"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Check, CircleAlert } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import {
  updatePost,
  approvePost,
  publishPost,
  archivePost,
  unarchivePost,
  requestReview,
  returnWithComments,
  getPublicationReadiness,
} from "@/lib/blog/actions/posts";
import { regenerateDraft } from "@/lib/blog/actions/drafts";
import { createRevision } from "@/lib/blog/actions/versions";
import type { BlogPostVersionMeta } from "@/lib/blog/versions";
import { editorActions, type WorkflowAction } from "@/lib/blog/workflow";
import { useAdmin } from "@/hooks/use-admin";
import { BlogPostEditSchema, type BlogPostEditInput } from "@/lib/blog/schemas";
import type { BlogPostSerialized, BlogPostStatus } from "@/lib/blog/types";
import type { PublicationIssue, PublicationVerdict } from "@/lib/blog/publication-gate";
import { Form } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
import { ReadinessPanel } from "./readiness-panel";
import { anchorTarget } from "./issue-anchors";
import { PostStatusChip } from "../../status-chip";
import { EscribirStage } from "./stages/escribir-stage";
import { OptimizarStage } from "./stages/optimizar-stage";
import { VerificarStage } from "./stages/verificar-stage";
import { PreviewStage } from "./stages/preview-stage";
import { AiToolsMenu } from "./ai-tools-menu";
import type { BlogActivityEntry } from "@/lib/blog/activity";
import type { UnsplashPhoto } from "@/lib/unsplash-egress";

// ─── Constants ─────────────────────────────────────────────────────────────────

const AUTO_SAVE_DEBOUNCE_MS = 5000;

/** «dirty» = hay cambios desde el último guardado OK (autosave pendiente). */
type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

// ─── Main Component ────────────────────────────────────────────────────────────

interface PostEditorClientProps {
  post: BlogPostSerialized;
  /** Último «devuelto con comentarios» vigente (solo cuando el post volvió a
   *  borrador por una devolución) — se muestra como banner para el autor. */
  lastReturn?: { message: string; actorName: string | null; createdAt: string } | null;
  /** Historial editorial (blog_activity, fire-safe: [] si no está disponible). */
  activity?: BlogActivityEntry[];
  /** B-PR6 — versiones del artículo (fire-safe: [] si no está disponible). */
  versions?: BlogPostVersionMeta[];
}

export function PostEditorClient({
  post,
  lastReturn = null,
  activity = [],
  versions = [],
}: PostEditorClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [postStatus, setCurrentStatus] = useState<BlogPostStatus>(post.status);
  const [slug, setSlug] = useState(post.slug);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnComment, setReturnComment] = useState("");
  const { isAdmin } = useAdmin();
  const [verdict, setVerdict] = useState<PublicationVerdict | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(true);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // B-PR4: el estado de la etapa se controla aquí para que los deep-links del
  // panel de publicación puedan cambiar de pestaña antes de hacer scroll.
  const [activeTab, setActiveTab] = useState("escribir");

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
      // B-PR5 — atribución de la portada (vive en seo.coverAttribution)
      coverAttribution: post.seo.coverAttribution ?? "",
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

  const watchedBody = form.watch("body");

  // ── Unsplash picker ──────────────────────────────────────────────────────────
  const handleUnsplashSelect = useCallback(
    (photo: UnsplashPhoto, searchQuery: string) => {
      form.setValue("coverImage", photo.regularUrl, { shouldDirty: true });
      if (!(form.getValues("coverImageAlt") ?? "").trim()) {
        form.setValue("coverImageAlt", photo.altDescription || searchQuery, {
          shouldDirty: true,
        });
      }
      toast.success(`Portada seleccionada — foto de ${photo.authorName} en Unsplash`);
    },
    [form],
  );

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

  // ── Deep-link de un issue del gate (B-PR4): etapa → scroll → resalte ────────
  const handleIssueClick = useCallback((issue: PublicationIssue) => {
    const target = anchorTarget(issue);
    setActiveTab(target.stage);
    // Tras un tick: la etapa destino debe estar montada antes de buscar el nodo.
    setTimeout(() => {
      if (!target.elementId) return;
      const el = document.getElementById(target.elementId);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Resalte temporal del contenedor del campo.
      const HIGHLIGHT = ["ring-2", "ring-blue-500/60", "rounded-lg", "transition-shadow"];
      el.classList.add(...HIGHLIGHT);
      setTimeout(() => el.classList.remove(...HIGHLIGHT), 2000);
      // Anchors con excerpt sobre el cuerpo: se selecciona el fragmento exacto.
      const excerpt = issue.anchor?.excerpt;
      if (excerpt) {
        const textarea = el.querySelector("textarea");
        if (textarea) {
          const idx = textarea.value.indexOf(excerpt);
          if (idx >= 0) {
            textarea.focus({ preventScroll: true });
            textarea.setSelectionRange(idx, idx + excerpt.length);
          }
        }
      }
    }, 50);
  }, []);

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
      // B-PR2: guardar NO cambia el estado — «Enviar a revisión» es explícito.
      setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 3000);
      void refreshReadiness();
    } else {
      setSaveStatus("error");
      setSaveError(result.error ?? "Error al guardar");
    }
  }, [form, post.id, refreshReadiness]);

  // Suscripción a TODOS los campos (antes solo title/excerpt/body): cualquier
  // cambio — tags, SEO, fuentes, enlaces, editorial — reinicia el debounce y
  // marca «Cambios sin guardar» hasta que un guardado termine OK.
  useEffect(() => {
    const subscription = form.watch(() => {
      setSaveStatus("dirty");
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
        setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 3000);
        void refreshReadiness();
      } else {
        setSaveStatus("error");
        setSaveError(result.error ?? "Error al guardar");
        toast.error(result.error ?? "Error al guardar");
      }
    });
  }

  function handleRequestReview() {
    startTransition(async () => {
      const result = await requestReview(post.id);
      if (result.ok) {
        setCurrentStatus("needs-review");
        toast.success("Enviado a revisión");
        void refreshReadiness();
      } else {
        toast.error(result.error ?? "Error");
      }
    });
  }

  function executeReturn() {
    startTransition(async () => {
      const result = await returnWithComments(post.id, returnComment);
      if (result.ok) {
        setReturnOpen(false);
        setReturnComment("");
        setCurrentStatus("draft");
        toast.success("Devuelto al autor con comentarios");
        void refreshReadiness();
      } else {
        toast.error(result.error ?? "Error al devolver");
      }
    });
  }

  function handleUnarchive() {
    startTransition(async () => {
      const result = await unarchivePost(post.id);
      if (result.ok) {
        setCurrentStatus("draft");
        toast.success("Artículo restaurado como borrador");
        void refreshReadiness();
      } else {
        toast.error(result.error ?? "Error al restaurar");
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
      // El auto-save tiene un debounce de AUTO_SAVE_DEBOUNCE_MS: si se publica
      // justo después de cambiar la portada (u otro campo), publishPost podía
      // leer la fila todavía sin ese cambio. Se persiste el estado actual del
      // formulario primero, igual que handleSaveDraft, y solo entonces se publica.
      const data = form.getValues();
      const parsed = BlogPostEditSchema.safeParse(data);
      if (!parsed.success) {
        const issue = parsed.error.errors[0];
        const message = issue
          ? `${issue.path.join(".") || "formulario"}: ${issue.message}`
          : "Datos inválidos";
        toast.error(`No se pudo guardar antes de publicar — ${message}`);
        return;
      }
      const saveResult = await updatePost(post.id, parsed.data);
      if (!saveResult.ok) {
        toast.error(saveResult.error ?? "Error al guardar antes de publicar");
        return;
      }

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
        toast.success("Artículo regenerado — la versión anterior quedó en el historial. Recargando…");
        router.refresh();
      } else {
        toast.error(result.error ?? "Error al regenerar");
      }
    });
  }

  // B-PR6: congela lo publicado como versión `nueva-revision`; la edición
  // sigue in situ (el artículo no cambia de estado ni se duplica).
  function handleCreateRevision() {
    startTransition(async () => {
      const result = await createRevision(post.id);
      if (result.ok && result.data) {
        toast.success(
          `Versión ${result.data.version} guardada — edita con calma: lo publicado quedó congelado en el historial.`,
        );
        router.refresh();
      } else {
        toast.error(result.error ?? "Error al crear la revisión");
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

  // ── Acciones por estado (workflow.ts) ──────────────────────────────────────
  const actions = editorActions(postStatus, { isAdmin });

  const TONE_CLASS: Record<WorkflowAction["tone"], string> = {
    primary: "w-full bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40",
    success: "w-full bg-green-600 hover:bg-green-500 text-white font-semibold disabled:opacity-50",
    warning:
      "w-full border border-yellow-500/30 bg-transparent text-yellow-400 hover:bg-yellow-500/10 hover:text-yellow-300 disabled:opacity-40",
    danger:
      "w-full border border-red-500/30 bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40",
    muted:
      "w-full border border-border bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40",
  };

  function renderWorkflowButton(action: WorkflowAction) {
    if (action.id === "view-public") {
      return (
        <Button key={action.id} asChild className={TONE_CLASS[action.tone]}>
          <a href={`/blog/${slug}`} target="_blank" rel="noopener noreferrer">
            {action.label}
          </a>
        </Button>
      );
    }
    // B-PR6: el botón plano «Regenerar con IA» se sustituye por el menú
    // «Herramientas de IA» (proponen sin escribir; regenerar pide confirmación
    // y guarda versión previa).
    if (action.id === "regenerate") {
      return (
        <AiToolsMenu
          key={action.id}
          postId={post.id}
          form={form}
          onRegenerate={handleRegenerate}
          disabled={isPending}
        />
      );
    }
    const handler: Record<string, () => void> = {
      "request-review": handleRequestReview,
      approve: handleApprove,
      "return-with-comments": () => setReturnOpen(true),
      publish: handlePublish,
      archive: handleArchive,
      unarchive: handleUnarchive,
      "create-revision": handleCreateRevision,
    };
    const disabled =
      isPending || (action.id === "publish" && hasBlockers);
    return (
      <Button
        key={action.id}
        type="button"
        onClick={handler[action.id]}
        disabled={disabled}
        className={TONE_CLASS[action.tone]}
      >
        {isPending ? <Spinner size="sm" className="mr-2" /> : null}
        {action.label}
      </Button>
    );
  }

  return (
    <>
      <AlertDialog open={returnOpen} onOpenChange={setReturnOpen}>
        <AlertDialogContent className="border-border bg-background text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Devolver con comentarios</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              El artículo vuelve a borrador y el autor verá tu comentario al abrirlo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={returnComment}
            onChange={(e) => setReturnComment(e.target.value)}
            rows={4}
            placeholder="Qué debe corregirse antes de volver a enviar a revisión…"
            className="bg-secondary/30"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border bg-secondary/50 text-foreground hover:bg-secondary">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                executeReturn();
              }}
              className="bg-yellow-600 text-white hover:bg-yellow-500"
            >
              Devolver al autor
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* Banner de devolución: el comentario del revisor acompaña al autor */}
      {postStatus === "draft" && lastReturn && (
        <div className="mb-4 rounded-lg border border-yellow-500/25 bg-yellow-500/10 px-4 py-3 text-sm">
          <p className="font-medium text-yellow-700 dark:text-yellow-300">
            Devuelto con comentarios{lastReturn.actorName ? ` por ${lastReturn.actorName}` : ""}:
          </p>
          <p className="mt-1 text-yellow-700/90 dark:text-yellow-200/90">{lastReturn.message}</p>
        </div>
      )}

      <Form {...form}>
      <form className="grid grid-cols-1 gap-6 pb-16 lg:grid-cols-3">
        {/* ── Main editor (2/3) ── */}
        {/* min-w-0: sin esto, un valor largo y sin espacios en el input de
            portada (una URL) puede forzar el ancho mínimo de esta columna
            del grid por encima del espacio disponible. */}
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-foreground">Editar post</h1>
            {/* Save status indicator — ciclo completo visible:
                dirty → saving → saved | error (con reintento manual). */}
            <span className="text-xs text-muted-foreground">
              {saveStatus === "dirty" && (
                <span className="text-muted-foreground">Cambios sin guardar</span>
              )}
              {saveStatus === "saving" && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Spinner size="sm" />
                  Guardando…
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="flex items-center gap-1 text-green-400">
                  <Check className="h-3 w-3" />
                  Guardado
                </span>
              )}
              {saveStatus === "error" && (
                <span
                  className="flex max-w-md items-center gap-1 text-red-400"
                  title={saveError ?? "Error al guardar"}
                >
                  <CircleAlert className="h-3 w-3 shrink-0" />
                  <span className="truncate">No se pudo guardar</span>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => void runAutoSave()}
                    className="font-medium underline underline-offset-2 hover:text-red-300"
                  >
                    Reintentar
                  </button>
                </span>
              )}
            </span>
          </div>

          {/* 4 etapas del flujo editorial (dictamen UX 2026-08-05 §3).
              Controladas (B-PR4): los deep-links del panel cambian de etapa. */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1">
              <TabsTrigger value="escribir">Escribir</TabsTrigger>
              <TabsTrigger value="optimizar">Optimizar</TabsTrigger>
              <TabsTrigger value="verificar">Verificar</TabsTrigger>
              <TabsTrigger value="preview">Vista previa</TabsTrigger>
            </TabsList>

            {/* ── Etapa 1: Escribir ── */}
            <TabsContent value="escribir">
              <EscribirStage form={form} postId={post.id} onUnsplashSelect={handleUnsplashSelect} />
            </TabsContent>

            {/* ── Etapa 2: Optimizar (SEO + enlaces internos + slug) ── */}
            <TabsContent value="optimizar">
              <OptimizarStage
                form={form}
                postId={post.id}
                slug={slug}
                isPublished={postStatus === "published"}
                onSlugChanged={handleSlugChanged}
              />
            </TabsContent>

            {/* ── Etapa 3: Verificar (evidencia + editorial + versiones + historial) ── */}
            <TabsContent value="verificar">
              <VerificarStage form={form} activity={activity} postId={post.id} versions={versions} />
            </TabsContent>

            {/* ── Etapa 4: Vista previa ── */}
            <TabsContent value="preview">
              <PreviewStage form={form} slug={slug} />
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
              <PostStatusChip status={postStatus} />
            </div>
          </section>

          {/* Readiness (gate de publicación) */}
          <ReadinessPanel verdict={verdict} loading={readinessLoading} onIssueClick={handleIssueClick} />

          {/* Actions card — derivadas del estado real (workflow.ts, B-PR2):
              cada estado muestra SOLO lo que le corresponde. */}
          <section className="rounded-xl border border-border bg-card p-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Acciones
            </h3>

            {/* Guardar es transversal: no cambia estado, solo persiste. */}
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
              {saveStatus === "saved" ? "Guardado" : "Guardar"}
            </Button>

            {actions.primary.map((a) => renderWorkflowButton(a))}

            {postStatus === "approved" && hasBlockers && (
              <p className="text-xs text-red-400">
                Hay bloqueos activos — revisa el panel de publicación.
              </p>
            )}

            {actions.secondary.length > 0 && (
              <div className="border-t border-border pt-2 space-y-2">
                {actions.secondary.map((a) => renderWorkflowButton(a))}
              </div>
            )}
          </section>
        </div>
      </form>
    </Form>
    </>
  );
}
