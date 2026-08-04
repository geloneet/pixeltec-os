import { formatEditorialDate } from '@/lib/blog/format-date';
import type {
  BlogBriefSerialized,
  BlogBriefStatus,
  BlogPostSerialized,
  BlogPostStatus,
} from '@/lib/blog/types';

/**
 * Lógica PURA del Blog Admin (rediseño 2026-08-04): mapeos de estado, acción
 * contextual por fila, filtros/orden/búsqueda y resumen editorial. Vive
 * separada del workspace para poder testearse sin DOM. Regla dura: un estado
 * desconocido DEGRADA (etiqueta cruda + gris + acción genérica), jamás rompe.
 */

// ── Estados ──────────────────────────────────────────────────────────────────

const POST_STATUS_LABEL: Record<BlogPostStatus, string> = {
  draft: 'Borrador',
  'needs-review': 'En revisión',
  approved: 'Aprobado',
  published: 'Publicado',
  archived: 'Archivado',
};

const POST_STATUS_CLASS: Record<BlogPostStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  'needs-review': 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300',
  approved: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  published: 'bg-green-500/15 text-green-700 dark:text-green-300',
  archived: 'bg-muted text-muted-foreground',
};

const BRIEF_STATUS_LABEL: Record<BlogBriefStatus, string> = {
  pending: 'Pendiente',
  generating: 'Generando',
  generated: 'Generado',
  discarded: 'Descartado',
};

const BRIEF_STATUS_CLASS: Record<BlogBriefStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  generating: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300',
  generated: 'bg-green-500/15 text-green-700 dark:text-green-300',
  discarded: 'bg-muted text-muted-foreground',
};

const FALLBACK_STATUS_CLASS = 'bg-muted text-muted-foreground';

export function postStatusLabel(status: string): string {
  return POST_STATUS_LABEL[status as BlogPostStatus] ?? status;
}
export function postStatusClass(status: string): string {
  return POST_STATUS_CLASS[status as BlogPostStatus] ?? FALLBACK_STATUS_CLASS;
}
export function briefStatusLabel(status: string): string {
  return BRIEF_STATUS_LABEL[status as BlogBriefStatus] ?? status;
}
export function briefStatusClass(status: string): string {
  return BRIEF_STATUS_CLASS[status as BlogBriefStatus] ?? FALLBACK_STATUS_CLASS;
}

// ── Acción contextual ────────────────────────────────────────────────────────

export interface PostNextAction {
  label: string;
  href: string;
  /** Abre en pestaña nueva (artículo público). */
  external?: boolean;
}

/** La siguiente acción editorial de un post según su estado real. «Publicar»
 *  lleva al editor: ahí vive el botón real protegido por el gate. */
export function postNextAction(post: Pick<BlogPostSerialized, 'id' | 'status' | 'slug'>): PostNextAction {
  const editor = `/blog-admin/${post.id}/editar`;
  switch (post.status) {
    case 'draft':
      return { label: 'Continuar', href: editor };
    case 'needs-review':
      return { label: 'Revisar', href: editor };
    case 'approved':
      return { label: 'Publicar', href: editor };
    case 'published':
      return { label: 'Ver artículo', href: `/blog/${post.slug}`, external: true };
    case 'archived':
      return { label: 'Ver', href: editor };
    default:
      return { label: 'Abrir', href: editor };
  }
}

export type BriefNextAction =
  | { kind: 'generate'; label: 'Generar borrador' }
  | { kind: 'generating'; label: 'Generando…' }
  | { kind: 'open'; label: 'Abrir borrador'; href: string }
  | { kind: 'none' };

/** Briefs `discarded` (o `generated` sin borrador enlazado) no tienen acción:
 *  no existe vista de detalle de brief y no se inventan botones. */
export function briefNextAction(
  brief: Pick<BlogBriefSerialized, 'status' | 'generatedDraftId'>
): BriefNextAction {
  switch (brief.status) {
    case 'pending':
      return { kind: 'generate', label: 'Generar borrador' };
    case 'generating':
      return { kind: 'generating', label: 'Generando…' };
    case 'generated':
      return brief.generatedDraftId
        ? { kind: 'open', label: 'Abrir borrador', href: `/blog-admin/${brief.generatedDraftId}/editar` }
        : { kind: 'none' };
    default:
      return { kind: 'none' };
  }
}

// ── Fecha con etiqueta (TZ editorial) ────────────────────────────────────────

export interface PostDateInfo {
  label: 'Publicado' | 'Actualizado' | 'Creado';
  text: string;
}

/** Prioridad: publicado > actualizado > creado — nada de una columna ambigua
 *  «Fecha». Formatea con la TZ editorial (America/Mexico_City). */
export function postDateInfo(
  post: Pick<BlogPostSerialized, 'status' | 'publishedAt' | 'updatedAt' | 'createdAt'>
): PostDateInfo {
  if (post.status === 'published' && post.publishedAt) {
    return { label: 'Publicado', text: formatEditorialDate(post.publishedAt) };
  }
  if (post.updatedAt && post.updatedAt !== post.createdAt) {
    return { label: 'Actualizado', text: formatEditorialDate(post.updatedAt) };
  }
  return { label: 'Creado', text: formatEditorialDate(post.createdAt) };
}

function postSortDate(post: Pick<BlogPostSerialized, 'updatedAt' | 'createdAt'>): string {
  return post.updatedAt || post.createdAt;
}

// ── Filtros, orden y búsqueda (en memoria: ≤ decenas de filas) ───────────────

export type SortOrder = 'recent' | 'oldest';
export type PostFilterStatus = 'all' | 'attention' | BlogPostStatus;
export type BriefFilterStatus = 'all' | BlogBriefStatus;

/** Necesita atención: en revisión, o aprobado sin publicar. */
export function needsAttention(post: Pick<BlogPostSerialized, 'status'>): boolean {
  return post.status === 'needs-review' || post.status === 'approved';
}

export function attentionCount(posts: Array<Pick<BlogPostSerialized, 'status'>>): number {
  return posts.filter(needsAttention).length;
}

export function filterPosts(
  posts: BlogPostSerialized[],
  opts: { query: string; status: PostFilterStatus; order: SortOrder }
): BlogPostSerialized[] {
  const q = opts.query.trim().toLowerCase();
  const filtered = posts.filter((p) => {
    if (opts.status === 'attention' && !needsAttention(p)) return false;
    if (opts.status !== 'all' && opts.status !== 'attention' && p.status !== opts.status) return false;
    if (q && !p.title.toLowerCase().includes(q)) return false;
    return true;
  });
  return filtered.sort((a, b) => {
    const cmp = postSortDate(b).localeCompare(postSortDate(a));
    return opts.order === 'recent' ? cmp : -cmp;
  });
}

export function filterBriefs(
  briefs: BlogBriefSerialized[],
  opts: { query: string; status: BriefFilterStatus; order: SortOrder }
): BlogBriefSerialized[] {
  const q = opts.query.trim().toLowerCase();
  const filtered = briefs.filter((b) => {
    if (opts.status !== 'all' && b.status !== opts.status) return false;
    if (q && !b.topic.toLowerCase().includes(q)) return false;
    return true;
  });
  return filtered.sort((a, b) => {
    const cmp = b.createdAt.localeCompare(a.createdAt);
    return opts.order === 'recent' ? cmp : -cmp;
  });
}

// ── Resumen editorial compacto ───────────────────────────────────────────────

/** «6 posts · 3 publicados · 3 borradores · 0 por revisar» (archivados fuera). */
export function editorialSummary(posts: Array<Pick<BlogPostSerialized, 'status'>>): string {
  const active = posts.filter((p) => p.status !== 'archived');
  const published = active.filter((p) => p.status === 'published').length;
  const drafts = active.filter((p) => p.status === 'draft').length;
  const review = active.filter((p) => p.status === 'needs-review').length;
  return `${active.length} posts · ${published} publicados · ${drafts} borradores · ${review} por revisar`;
}
