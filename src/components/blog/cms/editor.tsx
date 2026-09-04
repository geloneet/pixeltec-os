"use client";

/**
 * Editor del Blog (WO-2026-00088, paridad Encino `blog-editor.tsx`) adaptado a
 * PixelTEC OS: cuerpo en Markdown con el editor Tiptap existente, portada e
 * imágenes a R2, guardado por intención (autosave 2.5 s / borrador / publicar /
 * programar), inspector de 4 pestañas (Publicar · Contenido · SEO · Snippets).
 *
 * FASE 11: la pestaña «Snippets» se había omitido declarándola dependiente del
 * SEO Control Center de Encino. Era falso: solo dependía de DÓNDE guardar los
 * tipos. Aquí viven en `blog_posts.seo.schemaTypes` (jsonb aditivo, sin
 * migración) y se emiten server-side en `src/app/blog/[slug]/page.tsx`.
 */
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bot, CalendarClock, ExternalLink, Eye, History, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { generateSlug } from "@/lib/blog/ai/generate-post";
import type { BlogPostSerialized } from "@/lib/blog/types";
import type { BlogPostVersionMeta } from "@/lib/blog/versions";
import { extractMapsEmbedUrl } from "@/lib/blog-cms/maps-embed";
import { selectableBlogSchemaTypes } from "@/lib/blog-cms/schema-types";
import { AI_ARTICLE_TONES, toAiArticleParams, type AiArticleTone } from "@/lib/blog-cms/ai-params";
import { isSystemSlug } from "@/lib/blog-cms/transitions";
import { parseUnsplashImageUrl } from "@/lib/blog-cms/unsplash-url";
import type { BlogCmsIntent } from "@/lib/blog-cms/schemas";
import {
  discardEmptyBlogCmsDraft,
  restoreBlogCmsRevision,
  saveBlogCmsPost,
} from "@/lib/blog-cms/actions";
import { ADMIN_BLOG_PATH } from "@/lib/blog-cms/paths";
import { generateBlogCmsArticle, generateBlogCmsFaq } from "@/lib/blog-cms/ai";
import { StatusPill } from "./status-pill";
import { UnsplashPicker } from "./unsplash-picker";
import { formatEditorialDate } from "@/lib/blog/format-date";

const RichMarkdownEditor = dynamic(() => import("@/components/blog/rich-markdown-editor"), { ssr: false });

const AUTOSAVE_DELAY_MS = 2500;
const TABS = [
  { id: "publicar", label: "Publicar" },
  { id: "contenido", label: "Contenido" },
  { id: "seo", label: "SEO" },
  { id: "snippets", label: "Snippets" },
] as const;
type Tab = (typeof TABS)[number]["id"];

interface FaqItem { question: string; answer: string }

interface FormState {
  title: string;
  slug: string;
  body: string;
  metaDescription: string;
  seoTitle: string;
  noindex: boolean;
  nofollow: boolean;
  category: string;
  newCategory: string;
  tags: string;
  faq: FaqItem[];
  coverImage: string | null;
  coverImageAlt: string;
  mapsEmbed: string;
  schemaTypes: string[];
}

interface EditorProps {
  post: BlogPostSerialized;
  categories: string[];
  revisions: BlogPostVersionMeta[];
  isAdmin: boolean;
  startWithAi: boolean;
  /** Vistas acumuladas del post (blog_post_view_counts, WO-2026-00221). Métrica orientativa, ver comentario en el schema. */
  viewCount: number;
}

async function uploadImage(postId: string, file: File, endpoint: "/api/blog/cover" | "/api/blog/image"): Promise<string> {
  const body = new FormData();
  body.set("file", file);
  body.set("postId", postId);
  const res = await fetch(endpoint, { method: "POST", body });
  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !json.url) throw new Error(json.error ?? "No se pudo subir la imagen");
  return json.url;
}

export function BlogCmsEditor({ post, categories, revisions, isAdmin, startWithAi, viewCount }: EditorProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("publicar");
  const [status, setStatus] = useState<string>(post.status);
  const [publishedAt, setPublishedAt] = useState(post.publishedAt);
  const [scheduledAt, setScheduledAt] = useState(post.scheduledAt);
  const [form, setForm] = useState<FormState>({
    title: post.title,
    slug: post.slug,
    body: post.body,
    metaDescription: post.seo.metaDescription || post.excerpt,
    seoTitle: post.seo.metaTitle,
    noindex: post.seo.noindex,
    nofollow: post.seo.nofollow ?? false,
    category: post.category,
    newCategory: "",
    tags: post.tags.join(", "),
    faq: post.faq,
    coverImage: post.coverImage,
    coverImageAlt: post.seo.ogImageAlt,
    mapsEmbed: post.mapsEmbed ?? "",
    schemaTypes: post.seo.schemaTypes ?? [],
  });
  const [slugTouched, setSlugTouched] = useState(!isSystemSlug(post.slug) && post.slug !== generateSlug(post.title));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(startWithAi);
  const [aiRegen, setAiRegen] = useState(false);
  const [faqAiOpen, setFaqAiOpen] = useState(false);
  const [aiParams, setAiParams] = useState(toAiArticleParams(post.aiParams));
  const [coverUrlInput, setCoverUrlInput] = useState("");
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef(form);
  formRef.current = form;

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    dirtyRef.current = true;
  }, []);

  // «Restaurar revisión» (WO-2026-00206): antes este componente se remontaba
  // por completo vía `key={post.updatedAt}` en page.tsx para releer `post` en
  // los `useState` iniciales — pero esa key también remontaba el editor ante
  // CUALQUIER revalidación en segundo plano de la página (no solo al
  // restaurar), reiniciando el wizard «Con IA» a mitad de uso y perdiendo lo
  // escrito. Ahora, sin key, `restoreBlogCmsRevision` marca `restoringRef` y
  // este efecto resincroniza el formulario desde el `post` fresco cuando
  // `router.refresh()` lo trae — sin remontar nada más.
  const restoringRef = useRef(false);
  const syncFormFromPost = useCallback((p: BlogPostSerialized) => {
    setStatus(p.status);
    setPublishedAt(p.publishedAt);
    setScheduledAt(p.scheduledAt);
    setForm({
      title: p.title,
      slug: p.slug,
      body: p.body,
      metaDescription: p.seo.metaDescription || p.excerpt,
      seoTitle: p.seo.metaTitle,
      noindex: p.seo.noindex,
      nofollow: p.seo.nofollow ?? false,
      category: p.category,
      newCategory: "",
      tags: p.tags.join(", "),
      faq: p.faq,
      coverImage: p.coverImage,
      coverImageAlt: p.seo.ogImageAlt,
      mapsEmbed: p.mapsEmbed ?? "",
      schemaTypes: p.seo.schemaTypes ?? [],
    });
    setSlugTouched(!isSystemSlug(p.slug) && p.slug !== generateSlug(p.title));
    setAiParams(toAiArticleParams(p.aiParams));
    dirtyRef.current = false;
  }, []);
  useEffect(() => {
    if (!restoringRef.current) return;
    restoringRef.current = false;
    syncFormFromPost(post);
  }, [post, syncFormFromPost]);

  // Título → slug mientras el usuario no haya tocado el slug (paridad Encino).
  function onTitleChange(title: string) {
    setForm((f) => ({ ...f, title, slug: slugTouched ? f.slug : generateSlug(title) }));
    dirtyRef.current = true;
  }

  const buildPayload = useCallback((intent: BlogCmsIntent, when?: string) => {
    const f = formRef.current;
    return {
      id: post.id,
      title: f.title,
      body: f.body,
      metaDescription: f.metaDescription,
      seoTitle: f.seoTitle,
      noindex: f.noindex,
      nofollow: f.nofollow,
      slug: f.slug,
      category: f.category || null,
      newCategory: f.newCategory || undefined,
      tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
      faq: f.faq,
      coverImage: f.coverImage,
      coverImageAlt: f.coverImageAlt,
      mapsEmbed: f.mapsEmbed,
      schemaTypes: f.schemaTypes,
      intent,
      scheduledAt: when,
    };
  }, [post.id]);

  const doSave = useCallback(async (intent: BlogCmsIntent, when?: string): Promise<boolean> => {
    setSaveState("saving");
    const res = await saveBlogCmsPost(buildPayload(intent, when));
    if (!res.ok || !res.data) {
      setSaveState("error");
      toast.error(res.error ?? "No se pudo guardar");
      return false;
    }
    dirtyRef.current = false;
    setSaveState("saved");
    setSavedAt(new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }));
    setStatus(res.data.status);
    setPublishedAt(res.data.publishedAt);
    setScheduledAt(res.data.scheduledAt);
    if (res.data.slug !== formRef.current.slug) setForm((f) => ({ ...f, slug: res.data!.slug }));
    if (formRef.current.newCategory) setForm((f) => ({ ...f, category: f.newCategory, newCategory: "" }));
    if (intent !== "autosave") {
      toast.success(intent === "publish" ? "Entrada publicada" : intent === "schedule" ? "Entrada programada" : "Borrador guardado");
      router.refresh();
    }
    return true;
  }, [buildPayload, router]);
  const doSaveRef = useRef(doSave);
  doSaveRef.current = doSave;

  // Autosave 2.5 s tras el último cambio (nunca cambia estado ni crea revisión).
  useEffect(() => {
    if (!dirtyRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void doSaveRef.current("autosave"), AUTOSAVE_DELAY_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [form]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirtyRef.current) { e.preventDefault(); } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Bug reportado por Miguel (WO-2026-00198): el popup «crear con IA»
  // reaparecía al guardar/publicar una entrada YA EXISTENTE. Causa raíz #1:
  // `startWithAi` viene de `?ia=1` en la URL (puesto por «Nueva entrada con
  // IA», new-post-button.tsx) y nunca se limpiaba. Fix: retirar el parámetro
  // de la URL apenas se consume.
  useEffect(() => {
    if (startWithAi) router.replace(`${ADMIN_BLOG_PATH}/${post.id}/editar`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const explicit = (intent: BlogCmsIntent, when?: string) => start(async () => { await doSave(intent, when); });

  const mapsCheck = form.mapsEmbed.trim() ? (extractMapsEmbedUrl(form.mapsEmbed) ? "ok" : "bad") : null;
  const tagList = useMemo(() => form.tags.split(",").map((t) => t.trim()).filter(Boolean), [form.tags]);
  const host = typeof window !== "undefined" ? window.location.host : "pixeltec.mx";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href={ADMIN_BLOG_PATH} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Blog
        </Link>
        <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-live="polite">
          <StatusPill status={status} />
          <span className="inline-flex items-center gap-1" title={`${viewCount.toLocaleString("es-MX")} vistas`}>
            <Eye className="h-3.5 w-3.5" /> {viewCount.toLocaleString("es-MX")}
          </span>
          {saveState === "saving" && <span>Guardando…</span>}
          {saveState === "saved" && savedAt && <span>✓ Guardado a las {savedAt}</span>}
          {saveState === "error" && <span className="text-red-400">Error al guardar</span>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ── Columna principal ── */}
        <div className="space-y-4">
          <Input
            value={form.title}
            onChange={(e) => onTitleChange(e.target.value.slice(0, 300))}
            placeholder="Título de la entrada"
            aria-label="Título"
            className="h-12 text-lg font-semibold"
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>/blog/</span>
            <Input
              value={form.slug}
              onChange={(e) => { setSlugTouched(true); set("slug", e.target.value.toLowerCase().slice(0, 120)); }}
              aria-label="Slug"
              className="h-7 max-w-md text-xs"
            />
          </div>
          <RichMarkdownEditor
            value={form.body}
            onChange={(md) => set("body", md)}
            onUploadImage={(file) => uploadImage(post.id, file, "/api/blog/image")}
          />
        </div>

        {/* ── Inspector ── */}
        <aside className="space-y-4">
          <div role="tablist" aria-label="Inspector" className="flex rounded-lg border border-border p-0.5">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} type="button" onClick={() => setTab(t.id)}
                className={cn("flex-1 rounded-md px-2 py-1.5 text-xs font-medium", tab === t.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Publicar */}
          <section hidden={tab !== "publicar"} className="space-y-4">
            <Card title="Publicación">
              <div className="space-y-2">
                {isAdmin ? (
                  <Button className="w-full" disabled={pending} onClick={() => explicit("publish")}>
                    {status === "published" ? "Guardar cambios" : status === "scheduled" ? "Publicar ahora" : "Publicar"}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">Publicar y programar requieren rol administrador.</p>
                )}
                <Button variant="outline" className="w-full" disabled={pending} onClick={() => explicit("draft")}>Guardar borrador</Button>
                {isAdmin && status !== "published" && (
                  <Button variant="outline" className="w-full gap-2" disabled={pending} onClick={() => setScheduleOpen(true)}>
                    <CalendarClock className="h-4 w-4" /> {status === "scheduled" ? "Reprogramar entrada" : "Programar entrada"}
                  </Button>
                )}
                {status === "scheduled" && scheduledAt && (
                  <p className="text-xs text-purple-300">Programada para {formatEditorialDate(scheduledAt)}.</p>
                )}
                {status === "published" && (
                  <a href={`/blog/${form.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:underline">
                    Ver entrada <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {aiParams && (
                  <button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => { setAiRegen(true); setAiOpen(true); }}>
                    <Sparkles className="h-3 w-3" /> Regenerar el artículo con IA…
                  </button>
                )}
                <p className="text-xs text-muted-foreground">Creada por {post.author.name}{publishedAt ? ` · publicada ${formatEditorialDate(publishedAt)}` : ""}</p>
              </div>
            </Card>
            <Card title="Historial de versiones" icon={<History className="h-3.5 w-3.5" />}>
              {revisions.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin revisiones todavía (se crean al guardar, publicar o programar).</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {revisions.map((r, i) => (
                    <li key={r.id} className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">v{r.version} · {formatEditorialDate(r.createdAt)} · {r.createdByName}{i === 0 ? " · actual" : ""}</span>
                      {i > 0 && (
                        <button type="button" className="text-cyan-400 hover:underline" disabled={pending} onClick={() => start(async () => {
                          const res = await restoreBlogCmsRevision(post.id, r.id);
                          if (!res.ok) toast.error(res.error ?? "Error"); else { toast.success(`Versión ${r.version} restaurada`); restoringRef.current = true; router.refresh(); }
                        })}>Restaurar</button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>

          {/* Contenido */}
          <section hidden={tab !== "contenido"} className="space-y-4">
            <Card title="Imagen destacada (portada)">
              {form.coverImage ? (
                <div className="space-y-2">
                  <div className="relative h-32 w-full overflow-hidden rounded-md"><Image src={form.coverImage} alt={form.coverImageAlt || ""} fill className="object-cover" unoptimized /></div>
                  <div className="flex gap-2">
                    <label className="cursor-pointer text-xs text-cyan-400 hover:underline">Cambiar<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void handleCover(e.target.files?.[0])} /></label>
                    <button type="button" className="text-xs text-muted-foreground hover:text-red-400" onClick={() => set("coverImage", null)}>Quitar</button>
                  </div>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground hover:border-cyan-500/40">
                  Subir portada (JPG/PNG/WebP, máx. 5 MB)
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void handleCover(e.target.files?.[0])} />
                </label>
              )}
              <div className="mt-3 flex items-center gap-2">
                <Input
                  value={coverUrlInput}
                  onChange={(e) => setCoverUrlInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handlePasteCoverUrl(); } }}
                  placeholder="Pegar URL de imagen de Unsplash…"
                  aria-label="URL de imagen de Unsplash"
                  className="h-8 text-xs"
                />
                <Button type="button" variant="outline" size="sm" onClick={handlePasteCoverUrl} disabled={!coverUrlInput.trim()}>Usar</Button>
              </div>
              <div className="mt-2">
                <UnsplashPicker
                  onSelect={(photo, query) => {
                    set("coverImage", photo.regularUrl);
                    if (!form.coverImageAlt.trim()) set("coverImageAlt", photo.altDescription || query);
                    toast.success(`Portada seleccionada — foto de ${photo.authorName} en Unsplash`);
                  }}
                />
              </div>
              <Field label="Texto alternativo (Alt Text)"><Input value={form.coverImageAlt} maxLength={200} onChange={(e) => set("coverImageAlt", e.target.value)} /></Field>
            </Card>
            <Card title="Categoría">
              <select aria-label="Categoría" value={form.category} onChange={(e) => set("category", e.target.value)} className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
                <option value="">— Sin categoría —</option>
                {Array.from(new Set([...categories, ...(form.category ? [form.category] : [])])).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <Field label="+ Nueva categoría"><Input value={form.newCategory} maxLength={80} placeholder="Se crea al guardar" onChange={(e) => set("newCategory", e.target.value)} /></Field>
            </Card>
            <Card title="Etiquetas">
              <Input value={form.tags} placeholder="separadas por coma" onChange={(e) => set("tags", e.target.value)} aria-label="Etiquetas" />
              {tagList.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{tagList.map((t) => <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{t}</span>)}</div>}
            </Card>
            <Card title="Preguntas y respuestas">
              <div className="space-y-2">
                {form.faq.map((item, i) => (
                  <details key={i} className="rounded-md border border-border p-2">
                    <summary className="cursor-pointer text-xs font-medium">{item.question || `Pregunta ${i + 1}`}</summary>
                    <div className="mt-2 space-y-2">
                      <Input value={item.question} maxLength={300} placeholder="Pregunta" onChange={(e) => set("faq", form.faq.map((f, j) => j === i ? { ...f, question: e.target.value } : f))} />
                      <Textarea value={item.answer} maxLength={2000} rows={3} placeholder="Respuesta" onChange={(e) => set("faq", form.faq.map((f, j) => j === i ? { ...f, answer: e.target.value } : f))} />
                      <button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400" onClick={() => set("faq", form.faq.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /> Quitar</button>
                    </div>
                  </details>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" className="gap-1" disabled={form.faq.length >= 20} onClick={() => set("faq", [...form.faq, { question: "", answer: "" }])}><Plus className="h-3 w-3" /> Agregar</Button>
                  <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setFaqAiOpen(true)}><Sparkles className="h-3 w-3" /> Insertar con IA</Button>
                </div>
              </div>
            </Card>
            <Card title="Ubicación (Google Maps)">
              <Textarea rows={3} value={form.mapsEmbed} maxLength={2000} placeholder="Pega la URL del embed o el <iframe> de Google Maps" onChange={(e) => set("mapsEmbed", e.target.value)} aria-label="Google Maps embed" />
              {mapsCheck === "ok" && <p className="mt-1 text-xs text-green-400">✓ Embed válido de Google Maps</p>}
              {mapsCheck === "bad" && <p className="mt-1 text-xs text-amber-400">Solo se acepta un embed oficial de Google Maps (google.com/maps/embed…). No se guardará.</p>}
            </Card>
          </section>

          {/* SEO */}
          <section hidden={tab !== "seo"} className="space-y-4">
            <Card title="Ayuda para Google">
              <div className="rounded-md border border-border bg-white p-3 text-black">
                <p className="text-xs text-zinc-600">{host} › blog › {form.slug}</p>
                <p className="truncate text-base text-[#1a0dab]">{form.seoTitle || form.title || "Título de la entrada"}</p>
                <p className="line-clamp-2 text-xs text-zinc-700">{form.metaDescription || "Resumen que verán los lectores en Google."}</p>
              </div>
              <Field label={`Título en Google (title tag) · ${form.seoTitle.length}/70`}><Input aria-label="Título en Google" value={form.seoTitle} maxLength={70} onChange={(e) => set("seoTitle", e.target.value)} /></Field>
              <Field label={`Resumen para Google (meta description) · ${form.metaDescription.length}/160`}><Textarea aria-label="Resumen para Google" rows={3} value={form.metaDescription} maxLength={160} onChange={(e) => set("metaDescription", e.target.value)} /></Field>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.noindex} onChange={(e) => set("noindex", e.target.checked)} /> noindex (no aparece en buscadores ni en el sitio público)</label>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.nofollow} onChange={(e) => set("nofollow", e.target.checked)} /> nofollow</label>
            </Card>
          </section>

          {/* Snippets — paridad Encino (tab «Snippets»). Los tipos viajan en el
              guardado normal de la entrada; no hay botón aparte. */}
          <section hidden={tab !== "snippets"} className="space-y-4">
            <Card title="Rich snippets">
              <p className="text-xs text-muted-foreground">
                Datos estructurados que esta entrada ya envía a Google en automático:
              </p>
              <ul className="mt-2 space-y-1.5 text-xs text-foreground">
                <li className="flex items-center gap-2"><span aria-hidden className="text-emerald-600">✓</span>Artículo (BlogPosting)</li>
                <li className="flex items-center gap-2"><span aria-hidden className="text-emerald-600">✓</span>Migas de pan (BreadcrumbList)</li>
                <li className="flex items-center gap-2">
                  <span aria-hidden className={form.faq.length > 0 ? "text-emerald-600" : "text-muted-foreground"}>{form.faq.length > 0 ? "✓" : "○"}</span>
                  <span>
                    FAQ —{" "}
                    {form.faq.length > 0
                      ? `activo (${form.faq.length} ${form.faq.length === 1 ? "pregunta" : "preguntas"})`
                      : "se activa al agregar preguntas en Contenido"}
                  </span>
                </li>
              </ul>

              <div className="mt-4 border-t border-border/60 pt-3">
                <p className="text-xs font-medium text-foreground">Tipos adicionales para esta entrada</p>
                {form.schemaTypes.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {form.schemaTypes.map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-foreground">
                        {t}
                        <button
                          type="button"
                          aria-label={`Quitar ${t}`}
                          onClick={() => set("schemaTypes", form.schemaTypes.filter((x) => x !== t))}
                          className="text-muted-foreground transition-colors hover:text-destructive"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <select
                  value=""
                  aria-label="Agregar tipo de rich snippet"
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value && !form.schemaTypes.includes(value)) set("schemaTypes", [...form.schemaTypes, value]);
                  }}
                  className="mt-2 h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">+ Agregar tipo…</option>
                  {selectableBlogSchemaTypes()
                    .filter((t) => !form.schemaTypes.includes(t.value))
                    .map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                </select>
                <p className="mt-2 text-xs text-muted-foreground">
                  Cada tipo se publica como JSON-LD adicional en la entrada. Se guardan con la entrada (autosave, borrador o publicar).
                </p>
              </div>
            </Card>
          </section>
        </aside>
      </div>

      <ScheduleDialog open={scheduleOpen} onOpenChange={setScheduleOpen} current={scheduledAt} onConfirm={(iso) => { setScheduleOpen(false); explicit("schedule", iso); }} />
      <AiArticleDialog
        open={aiOpen}
        regen={aiRegen}
        initial={aiParams}
        postId={post.id}
        currentTitle={form.title}
        currentBody={form.body}
        onOpenChange={(o) => { setAiOpen(o); if (!o) setAiRegen(false); }}
        onDiscardPristine={() => start(async () => {
          const res = await discardEmptyBlogCmsDraft(post.id);
          if (res.ok && res.data?.deleted) router.replace(ADMIN_BLOG_PATH);
        })}
        onResult={(r, params) => {
          setForm((f) => ({ ...f, title: r.title, slug: slugTouched ? f.slug : generateSlug(r.title), metaDescription: r.metaDescription, body: r.body, tags: r.tags.join(", ") }));
          setAiParams(params);
          dirtyRef.current = true;
        }}
        pristine={!form.title.trim() && !form.body.trim() && !form.coverImage}
      />
      <AiFaqDialog open={faqAiOpen} onOpenChange={setFaqAiOpen} postId={post.id} title={form.title} body={form.body} existing={form.faq.map((f) => f.question)} onResult={(items) => set("faq", [...form.faq, ...items].slice(0, 20))} />
    </div>
  );

  async function handleCover(file: File | undefined) {
    if (!file) return;
    try {
      const url = await uploadImage(post.id, file, "/api/blog/cover");
      set("coverImage", url);
      toast.success("Portada subida");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir la portada");
    }
  }

  function handlePasteCoverUrl() {
    const result = parseUnsplashImageUrl(coverUrlInput);
    if (!result.ok) { toast.error(result.error); return; }
    set("coverImage", result.url);
    setCoverUrlInput("");
    toast.success("Portada actualizada desde la URL");
  }
}

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{icon}{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** «Programar entrada» (paridad Encino `schedule-post-dialog.tsx`): datetime-local futuro → ISO. */
function ScheduleDialog({ open, onOpenChange, current, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; current: string | null; onConfirm: (iso: string) => void }) {
  const [value, setValue] = useState(toLocalInput(current));
  const future = value && new Date(value).getTime() > Date.now();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-background text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Programar entrada</DialogTitle>
          <DialogDescription className="text-muted-foreground">Se publicará automáticamente a partir de la fecha y hora elegidas.</DialogDescription>
        </DialogHeader>
        <Input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Fecha y hora de publicación" />
        {value && !future && <p className="text-xs text-amber-400">Elige una fecha y hora futuras.</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!future} onClick={() => onConfirm(new Date(value).toISOString())}>Programar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type AiParamsState = { brief: string; tone: AiArticleTone; audience: string; internalLinkCount: number; externalLinkCount: number };

/** Wizard IA (paridad Encino `ai-article-dialog.tsx`, 4 pasos): brief → tono →
 *  audiencia → enlaces; modo «regenerar» pide la modificación. */
function AiArticleDialog({ open, regen, initial, postId, currentTitle, currentBody, pristine, onOpenChange, onResult, onDiscardPristine }: {
  open: boolean; regen: boolean; initial: AiParamsState | null; postId: string; currentTitle: string; currentBody: string; pristine: boolean;
  onOpenChange: (o: boolean) => void; onResult: (r: { title: string; metaDescription: string; tags: string[]; body: string }, params: AiParamsState) => void; onDiscardPristine: () => void;
}) {
  const [step, setStep] = useState(0);
  const [params, setParams] = useState<AiParamsState>(initial ?? { brief: "", tone: "informativo", audience: "", internalLinkCount: 2, externalLinkCount: 1 });
  const [modification, setModification] = useState("");
  const [busy, setBusy] = useState(false);
  const steps = regen ? ["Modificación"] : ["Brief", "Tono", "Audiencia", "Enlaces"];

  async function run() {
    setBusy(true);
    const res = await generateBlogCmsArticle({ postId, ...params, ...(regen ? { modification, currentTitle, currentBody } : {}) });
    setBusy(false);
    if (!res.ok || !res.data) { toast.error(res.error ?? "Error de IA"); return; }
    onResult(res.data, params);
    onOpenChange(false);
    setStep(0);
    toast.success(regen ? "Artículo regenerado" : "Artículo propuesto: revísalo antes de publicar");
  }

  function close() {
    onOpenChange(false);
    setStep(0);
    if (!regen && pristine) onDiscardPristine();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : close())}>
      <DialogContent className="border-border bg-background text-foreground sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bot className="h-4 w-4 text-cyan-400" /> {regen ? "Regenerar con IA" : `Generar con IA · paso ${step + 1} de ${steps.length}`}</DialogTitle>
          <DialogDescription className="text-muted-foreground">{regen ? "Describe qué cambiar; se reescribe sobre la versión actual." : "La IA propone un borrador; tú lo revisas y decides."}</DialogDescription>
        </DialogHeader>
        {regen ? (
          <Textarea rows={4} value={modification} maxLength={2000} placeholder="Ej.: hazlo más corto y añade un ejemplo para restaurantes" onChange={(e) => setModification(e.target.value)} />
        ) : step === 0 ? (
          <Textarea rows={6} value={params.brief} maxLength={10000} placeholder="¿De qué trata el artículo? Puntos clave, contexto, objetivo…" onChange={(e) => setParams({ ...params, brief: e.target.value })} />
        ) : step === 1 ? (
          <div className="grid grid-cols-2 gap-2">
            {AI_ARTICLE_TONES.map((t) => (
              <button key={t} type="button" onClick={() => setParams({ ...params, tone: t })} className={cn("rounded-md border px-3 py-2 text-sm capitalize", params.tone === t ? "border-cyan-500 bg-cyan-500/10" : "border-border hover:bg-secondary/40")}>{t}</button>
            ))}
          </div>
        ) : step === 2 ? (
          <Input value={params.audience} maxLength={300} placeholder="Ej.: dueños de PyMEs en Puerto Vallarta" onChange={(e) => setParams({ ...params, audience: e.target.value })} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs">Enlaces internos (0-8)<Input type="number" min={0} max={8} value={params.internalLinkCount} onChange={(e) => setParams({ ...params, internalLinkCount: Math.min(8, Math.max(0, Number(e.target.value) || 0)) })} /></label>
            <label className="text-xs">Enlaces externos (0-8)<Input type="number" min={0} max={8} value={params.externalLinkCount} onChange={(e) => setParams({ ...params, externalLinkCount: Math.min(8, Math.max(0, Number(e.target.value) || 0)) })} /></label>
          </div>
        )}
        <DialogFooter>
          {!regen && step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)} disabled={busy}>Atrás</Button>}
          {!regen && step < steps.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={(step === 0 && params.brief.trim().length < 10) || (step === 2 && params.audience.trim().length < 3)}>Siguiente</Button>
          ) : (
            <Button onClick={() => void run()} disabled={busy || (regen ? modification.trim().length < 3 : params.audience.trim().length < 3)}>{busy ? "Generando…" : regen ? "Regenerar" : "Generar artículo"}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AiFaqDialog({ open, onOpenChange, postId, title, body, existing, onResult }: { open: boolean; onOpenChange: (o: boolean) => void; postId: string; title: string; body: string; existing: string[]; onResult: (items: FaqItem[]) => void }) {
  const [count, setCount] = useState(3);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-background text-foreground sm:max-w-md">
        <DialogHeader><DialogTitle>Preguntas frecuentes con IA</DialogTitle><DialogDescription className="text-muted-foreground">Se generan a partir del contenido actual del artículo.</DialogDescription></DialogHeader>
        <label className="text-xs">Cantidad (1-8)<Input type="number" min={1} max={8} value={count} onChange={(e) => setCount(Math.min(8, Math.max(1, Number(e.target.value) || 1)))} /></label>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={busy || body.trim().length < 50} onClick={async () => {
            setBusy(true);
            const res = await generateBlogCmsFaq({ postId, count, title, body, existingQuestions: existing });
            setBusy(false);
            if (!res.ok || !res.data) { toast.error(res.error ?? "Error de IA"); return; }
            onResult(res.data.faq);
            onOpenChange(false);
          }}>{busy ? "Generando…" : "Insertar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
