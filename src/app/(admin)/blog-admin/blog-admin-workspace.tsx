'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { archivePost } from '@/lib/blog/actions/posts';
import { getBriefGenerationStatus, startDraftGeneration } from '@/lib/blog/actions/drafts';
import { formatEditorialDate } from '@/lib/blog/format-date';
import { cn } from '@/lib/utils';
import type { BlogBriefSerialized, BlogPostSerialized } from '@/lib/blog/types';
import {
  attentionCount,
  briefNextAction,
  briefStatusClass,
  briefStatusLabel,
  filterBriefs,
  filterPosts,
  postDateInfo,
  postNextAction,
  postStatusClass,
  postStatusLabel,
  type BriefFilterStatus,
  type PostFilterStatus,
  type SortOrder,
} from './blog-admin-logic';

/**
 * Workspace del Blog Admin (rediseño 2026-08-04): una sola herramienta con dos
 * vistas (Posts/Briefs), toolbar de tres controles y acción contextual por
 * fila. Todo el filtrado corre en memoria sobre los datos que el Server
 * Component ya cargó — cero queries nuevas, cero contratos tocados.
 */

const POST_FILTER_OPTIONS: Array<{ value: PostFilterStatus; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'attention', label: 'Necesita atención' },
  { value: 'draft', label: 'Borrador' },
  { value: 'needs-review', label: 'En revisión' },
  { value: 'approved', label: 'Aprobado' },
  { value: 'published', label: 'Publicado' },
  { value: 'archived', label: 'Archivado' },
];

const BRIEF_FILTER_OPTIONS: Array<{ value: BriefFilterStatus; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'generating', label: 'Generando' },
  { value: 'generated', label: 'Generado' },
  { value: 'discarded', label: 'Descartado' },
];

const numberFmt = new Intl.NumberFormat('es-MX');

function StatusChip({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium', className)}>
      {label}
    </span>
  );
}

export function BlogAdminWorkspace({
  posts,
  briefs,
}: {
  posts: BlogPostSerialized[];
  briefs: BlogBriefSerialized[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'posts' | 'briefs'>('posts');
  const [postQuery, setPostQuery] = useState('');
  const [briefQuery, setBriefQuery] = useState('');
  const [postStatus, setPostStatus] = useState<PostFilterStatus>('all');
  const [briefStatus, setBriefStatus] = useState<BriefFilterStatus>('all');
  const [order, setOrder] = useState<SortOrder>('recent');

  const visiblePosts = useMemo(
    () => filterPosts(posts, { query: postQuery, status: postStatus, order }),
    [posts, postQuery, postStatus, order]
  );
  const visibleBriefs = useMemo(
    () => filterBriefs(briefs, { query: briefQuery, status: briefStatus, order }),
    [briefs, briefQuery, briefStatus, order]
  );
  const attention = attentionCount(posts);

  // ── Archivar (dos pasos dentro del menú ⋯) ─────────────────────────────────
  const [confirmingArchiveId, setConfirmingArchiveId] = useState<string | null>(null);
  async function handleArchive(postId: string) {
    setConfirmingArchiveId(null);
    const res = await archivePost(postId);
    if (!res.ok) {
      toast.error(res.error ?? 'No se pudo archivar el post');
      return;
    }
    toast.success('Post archivado — deja de listarse como activo');
    router.refresh();
  }

  // ── Generación de brief (reusa la Fase B asíncrona, con polling) ───────────
  const [generatingIds, setGeneratingIds] = useState<ReadonlySet<string>>(
    () => new Set(briefs.filter((b) => b.status === 'generating').map((b) => b.id))
  );
  const startedByMe = useRef<Set<string>>(new Set());

  async function handleGenerate(briefId: string) {
    const res = await startDraftGeneration(briefId);
    if (!res.ok) {
      toast.error(res.error ?? 'No se pudo iniciar la generación');
      return;
    }
    startedByMe.current.add(briefId);
    setGeneratingIds((prev) => new Set(prev).add(briefId));
    toast.success('Generando borrador — te llevamos al editor al terminar.');
  }

  useEffect(() => {
    if (generatingIds.size === 0) return;
    const startedAt = Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - startedAt > 5 * 60_000) {
        clearInterval(timer);
        return;
      }
      for (const id of Array.from(generatingIds)) {
        try {
          const res = await getBriefGenerationStatus(id);
          if (!res.ok || !res.data) continue;
          if (res.data.status === 'generated' && res.data.generatedDraftId) {
            if (startedByMe.current.has(id)) {
              router.push(`/blog-admin/${res.data.generatedDraftId}/editar`);
              return;
            }
            setGeneratingIds((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
            router.refresh();
          } else if (res.data.status === 'pending') {
            toast.error(res.data.lastError ?? 'La generación falló — reintenta desde el brief.');
            setGeneratingIds((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
            router.refresh();
          }
        } catch {
          // Red transitoria: siguiente tick decide.
        }
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [generatingIds, router]);

  const searchValue = tab === 'posts' ? postQuery : briefQuery;
  const resultCount = tab === 'posts' ? visiblePosts.length : visibleBriefs.length;

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as 'posts' | 'briefs')} className="space-y-4">
      {/* Franja de atención — solo si hay pendientes reales */}
      {attention > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-yellow-500/25 bg-yellow-500/10 px-4 py-2.5 text-sm text-yellow-700 dark:text-yellow-300">
          <span>
            {attention} contenido{attention === 1 ? '' : 's'} necesita{attention === 1 ? '' : 'n'} atención
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-yellow-700 hover:text-yellow-800 dark:text-yellow-300 dark:hover:text-yellow-200"
            onClick={() => {
              setTab('posts');
              setPostStatus('attention');
            }}
          >
            Ver pendientes
          </Button>
        </div>
      )}

      <TabsList aria-label="Vistas del blog">
        <TabsTrigger value="posts">
          Posts <span className="ml-1.5 text-xs text-muted-foreground">{posts.length}</span>
        </TabsTrigger>
        <TabsTrigger value="briefs">
          Briefs <span className="ml-1.5 text-xs text-muted-foreground">{briefs.length}</span>
        </TabsTrigger>
      </TabsList>

      {/* Toolbar: búsqueda + estado + orden — nada más */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label={tab === 'posts' ? 'Buscar posts por título' : 'Buscar briefs por tema'}
            placeholder={tab === 'posts' ? 'Buscar por título…' : 'Buscar por tema…'}
            className="h-11 pl-9 md:h-9"
            value={searchValue}
            onChange={(e) => (tab === 'posts' ? setPostQuery(e.target.value) : setBriefQuery(e.target.value))}
          />
        </div>
        {tab === 'posts' ? (
          <Select value={postStatus} onValueChange={(v) => setPostStatus(v as PostFilterStatus)}>
            <SelectTrigger aria-label="Filtrar por estado" className="h-11 w-full sm:w-48 md:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POST_FILTER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select value={briefStatus} onValueChange={(v) => setBriefStatus(v as BriefFilterStatus)}>
            <SelectTrigger aria-label="Filtrar por estado" className="h-11 w-full sm:w-48 md:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BRIEF_FILTER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={order} onValueChange={(v) => setOrder(v as SortOrder)}>
          <SelectTrigger aria-label="Ordenar" className="h-11 w-full sm:w-44 md:h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Más recientes</SelectItem>
            <SelectItem value="oldest">Más antiguos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p aria-live="polite" className="sr-only">
        {resultCount} resultado{resultCount === 1 ? '' : 's'}
      </p>

      {/* ── Vista Posts ─────────────────────────────────────────────────────── */}
      <TabsContent value="posts" className="mt-0">
        {visiblePosts.length === 0 ? (
          <EmptyState
            hasFilters={postQuery.trim() !== '' || postStatus !== 'all'}
            noFilterTitle="Todavía no hay artículos."
            noFilterHint="Crea un brief para comenzar."
          />
        ) : (
          <ul className="divide-y divide-border">
            {visiblePosts.map((post) => {
              const action = postNextAction(post);
              const date = postDateInfo(post);
              const confirming = confirmingArchiveId === post.id;
              return (
                <li
                  key={post.id}
                  className="flex flex-col gap-3 py-4 md:grid md:grid-cols-[1fr_auto] md:items-center md:gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip label={postStatusLabel(post.status)} className={postStatusClass(post.status)} />
                      {post.category && (
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">{post.category}</span>
                      )}
                    </div>
                    <Link
                      href={`/blog-admin/${post.id}/editar`}
                      className="mt-1.5 block font-medium leading-snug text-foreground transition-colors hover:text-blue-400 line-clamp-2"
                    >
                      {post.title}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {post.wordCount > 0 && (
                        <>
                          {numberFmt.format(post.wordCount)} palabras
                          {post.readingTimeMin > 0 && <> · {post.readingTimeMin} min</>}
                          {' · '}
                        </>
                      )}
                      {date.label} {date.text}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 md:justify-end">
                    {action.external ? (
                      <Button asChild variant="outline" size="sm" className="h-11 md:h-9">
                        <a href={action.href} target="_blank" rel="noopener noreferrer">
                          {action.label}
                        </a>
                      </Button>
                    ) : (
                      <Button asChild variant="outline" size="sm" className="h-11 md:h-9">
                        <Link href={action.href}>{action.label}</Link>
                      </Button>
                    )}
                    <DropdownMenu onOpenChange={(open) => !open && setConfirmingArchiveId(null)}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 md:h-9 md:w-9"
                          aria-label={`Más acciones para ${post.title}`}
                        >
                          <MoreHorizontal className="h-4 w-4" aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/blog-admin/${post.id}/editar`}>Editar</Link>
                        </DropdownMenuItem>
                        {post.status === 'published' && (
                          <DropdownMenuItem asChild>
                            <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">
                              Ver en el sitio
                            </a>
                          </DropdownMenuItem>
                        )}
                        {post.status !== 'archived' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-rose-500 focus:text-rose-500"
                              onSelect={(e) => {
                                if (!confirming) {
                                  e.preventDefault();
                                  setConfirmingArchiveId(post.id);
                                  return;
                                }
                                void handleArchive(post.id);
                              }}
                            >
                              {confirming ? 'Confirmar: archivar este post' : 'Archivar…'}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </TabsContent>

      {/* ── Vista Briefs ────────────────────────────────────────────────────── */}
      <TabsContent value="briefs" className="mt-0">
        {visibleBriefs.length === 0 ? (
          <EmptyState
            hasFilters={briefQuery.trim() !== '' || briefStatus !== 'all'}
            noFilterTitle="No tienes briefs pendientes."
            noFilterHint="Crea una nueva idea cuando estés listo."
          />
        ) : (
          <ul className="divide-y divide-border">
            {visibleBriefs.map((brief) => {
              const generating = generatingIds.has(brief.id) || brief.status === 'generating';
              const action = generating
                ? ({ kind: 'generating', label: 'Generando…' } as const)
                : briefNextAction(brief);
              const secondary = brief.primaryKeyword || brief.targetAudience;
              return (
                <li
                  key={brief.id}
                  className="flex flex-col gap-3 py-4 md:grid md:grid-cols-[1fr_auto] md:items-center md:gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip
                        label={generating ? 'Generando' : briefStatusLabel(brief.status)}
                        className={briefStatusClass(generating ? 'generating' : brief.status)}
                      />
                      {secondary && <span className="text-xs text-muted-foreground">{secondary}</span>}
                    </div>
                    <p className="mt-1.5 font-medium leading-snug text-foreground line-clamp-2">{brief.topic}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Creado {formatEditorialDate(brief.createdAt)}</p>
                  </div>
                  <div className="flex items-center md:justify-end">
                    {action.kind === 'generate' && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-11 md:h-9"
                        onClick={() => void handleGenerate(brief.id)}
                      >
                        {action.label}
                      </Button>
                    )}
                    {action.kind === 'generating' && (
                      <Button type="button" variant="outline" size="sm" className="h-11 md:h-9" disabled aria-disabled="true">
                        Generando…
                      </Button>
                    )}
                    {action.kind === 'open' && (
                      <Button asChild variant="outline" size="sm" className="h-11 md:h-9">
                        <Link href={action.href}>{action.label}</Link>
                      </Button>
                    )}
                    {action.kind === 'none' && <span className="text-sm text-muted-foreground">—</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}

function EmptyState({
  hasFilters,
  noFilterTitle,
  noFilterHint,
}: {
  hasFilters: boolean;
  noFilterTitle: string;
  noFilterHint: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <p className="text-sm font-medium text-foreground">
        {hasFilters ? 'No encontramos contenido con esos filtros.' : noFilterTitle}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasFilters ? 'Limpia la búsqueda o cambia el estado.' : noFilterHint}
      </p>
      {!hasFilters && (
        <Button asChild variant="outline" size="sm" className="mt-4 h-11 md:h-9">
          <Link href="/blog-admin/nuevo">+ Nuevo brief</Link>
        </Button>
      )}
    </div>
  );
}
