"use client";

import {
  useState,
  useTransition,
  useEffect,
  useRef,
  KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { X, Check, Loader2 } from "lucide-react";
import { updatePost, setPostStatus, approvePost, publishPost, archivePost } from "@/lib/blog/actions/posts";
import { regenerateDraft } from "@/lib/blog/actions/drafts";
import { BlogPostEditSchema, type BlogPostEditInput } from "@/lib/blog/schemas";
import type { BlogPostSerialized, BlogPostStatus, BlogCategory } from "@/lib/blog/types";
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
  draft: "bg-zinc-700 text-zinc-300",
  "needs-review": "bg-yellow-500/20 text-yellow-300",
  approved: "bg-blue-500/20 text-blue-300",
  published: "bg-green-500/20 text-green-300",
  archived: "bg-zinc-800 text-zinc-500",
};

// ─── Tag Input ─────────────────────────────────────────────────────────────────

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
}

function TagInput({ value, onChange }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || value.includes(tag) || value.length >= 8) return;
    onChange([...value, tag]);
    setInputValue("");
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex min-h-[42px] flex-wrap gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-2">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-medium text-blue-300"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="text-blue-400 hover:text-blue-200 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (inputValue.trim()) addTag(inputValue);
        }}
        placeholder={value.length === 0 ? "Agregar etiqueta…" : ""}
        disabled={value.length >= 8}
        className="min-w-[120px] flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 outline-none disabled:cursor-not-allowed"
      />
    </div>
  );
}

// ─── Auto-save hook ────────────────────────────────────────────────────────────

type SaveStatus = "idle" | "saving" | "saved";

// ─── Main Component ────────────────────────────────────────────────────────────

interface PostEditorClientProps {
  post: BlogPostSerialized;
}

export function PostEditorClient({ post }: PostEditorClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [postStatus, setCurrentStatus] = useState<BlogPostStatus>(post.status);
  const [archiveOpen, setArchiveOpen] = useState(false);
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
    },
  });

  const watchedTitle = form.watch("title");
  const watchedExcerpt = form.watch("excerpt");
  const watchedBody = form.watch("body");
  const watchedSeoMetaTitle = form.watch("seoMetaTitle") ?? "";
  const watchedSeoMetaDescription = form.watch("seoMetaDescription") ?? "";

  // Auto-save debounced on body/title/excerpt changes
  useEffect(() => {
    if (!form.formState.isDirty) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    autoSaveTimer.current = setTimeout(async () => {
      const data = form.getValues();
      const parsed = BlogPostEditSchema.safeParse(data);
      if (!parsed.success) return;

      setSaveStatus("saving");
      const result = await updatePost(post.id, parsed.data);
      setSaveStatus(result.ok ? "saved" : "idle");

      if (result.ok) {
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    }, 5000);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedTitle, watchedExcerpt, watchedBody]);

  // Compute stats
  const wordCount = watchedBody
    ? watchedBody.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  function handleSaveDraft() {
    startTransition(async () => {
      const data = form.getValues();
      const result = await updatePost(post.id, data);
      if (result.ok) {
        toast.success("Borrador guardado");
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
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

  return (
    <>
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent className="bg-zinc-950 border border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">¿Archivar este post?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              El post será retirado de la lista activa. Puedes restaurarlo más tarde cambiando su estado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeArchive}
              className="bg-zinc-700 text-white hover:bg-zinc-600"
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
            <h1 className="text-xl font-bold text-zinc-100">Editar post</h1>
            {/* Save status indicator */}
            <span className="text-xs text-zinc-500">
              {saveStatus === "saving" && (
                <span className="flex items-center gap-1 text-zinc-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Guardando…
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="flex items-center gap-1 text-green-400">
                  <Check className="h-3 w-3" />
                  Guardado ✓
                </span>
              )}
            </span>
          </div>

          {/* Title */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-zinc-300">Título</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="bg-white/5 border-white/10 text-zinc-100 text-2xl font-bold placeholder:text-zinc-600 focus:border-blue-500/50 h-auto py-3"
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
                  <FormLabel className="text-zinc-300">Extracto</FormLabel>
                  <span
                    className={cn(
                      "text-xs",
                      (field.value?.length ?? 0) > 160
                        ? "text-red-400"
                        : "text-zinc-500",
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
                    className="bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500/50 resize-none"
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
                <FormLabel className="text-zinc-300">
                  Cuerpo (Markdown)
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={24}
                    placeholder="# Título&#10;&#10;Escribe el contenido en Markdown…"
                    className="bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500/50 resize-y font-mono text-sm"
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
                <FormLabel className="text-zinc-300">Etiquetas</FormLabel>
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
                <FormLabel className="text-zinc-300">Categoría</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="bg-white/5 border-white/10 text-zinc-100 focus:border-blue-500/50">
                      <SelectValue placeholder="Selecciona una categoría" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
                    {CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        className="focus:bg-zinc-800 focus:text-zinc-100"
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
        </div>

        {/* ── Sidebar (1/3) ── */}
        <div className="space-y-4">
          {/* Stats card */}
          <section className="rounded-xl border border-white/5 bg-white/[0.03] p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Estadísticas
            </h3>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Palabras</span>
              <span className="font-medium text-zinc-200">
                {new Intl.NumberFormat("es-MX").format(wordCount)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Lectura</span>
              <span className="font-medium text-zinc-200">
                ~{readingTime} min
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Estado</span>
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

          {/* SEO card */}
          <section className="rounded-xl border border-white/5 bg-white/[0.03] p-4 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              SEO
            </h3>

            <FormField
              control={form.control}
              name="seoMetaTitle"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-zinc-300 text-xs">
                      Meta título
                    </FormLabel>
                    <span
                      className={cn(
                        "text-xs",
                        watchedSeoMetaTitle.length > 70
                          ? "text-red-400"
                          : "text-zinc-500",
                      )}
                    >
                      {watchedSeoMetaTitle.length}/70
                    </span>
                  </div>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      maxLength={70}
                      placeholder="Meta título SEO"
                      className="bg-white/5 border-white/10 text-zinc-100 text-xs placeholder:text-zinc-600 focus:border-blue-500/50"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="seoMetaDescription"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-zinc-300 text-xs">
                      Meta descripción
                    </FormLabel>
                    <span
                      className={cn(
                        "text-xs",
                        watchedSeoMetaDescription.length > 160
                          ? "text-red-400"
                          : "text-zinc-500",
                      )}
                    >
                      {watchedSeoMetaDescription.length}/160
                    </span>
                  </div>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      rows={3}
                      maxLength={160}
                      placeholder="Meta descripción SEO"
                      className="bg-white/5 border-white/10 text-zinc-100 text-xs placeholder:text-zinc-600 focus:border-blue-500/50 resize-none"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          {/* Actions card */}
          <section className="rounded-xl border border-white/5 bg-white/[0.03] p-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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

            {/* Publish — only if approved */}
            {postStatus === "approved" && (
              <Button
                type="button"
                onClick={handlePublish}
                disabled={isPending}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Publicar
              </Button>
            )}

            <div className="border-t border-white/5 pt-2 space-y-2">
              {/* Regenerate */}
              <Button
                type="button"
                variant="outline"
                onClick={handleRegenerate}
                disabled={isPending}
                className="w-full border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-40"
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
