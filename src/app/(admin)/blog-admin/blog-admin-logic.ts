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
  scheduled: 'Programado',
  published: 'Publicado',
  archived: 'Archivado',
};

const POST_STATUS_CLASS: Record<BlogPostStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  'needs-review': 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300',
  approved: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  scheduled: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
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
/** `active` = todo menos archivados (filtro predeterminado: lo archivado es
 *  ruido en el trabajo diario y se consulta a demanda). */
export type PostFilterStatus = 'all' | 'active' | 'attention' | BlogPostStatus;
export type BriefFilterStatus = 'all' | BlogBriefStatus;

/** Necesita atención: en revisión, o aprobado sin publicar. */
export function needsAttention(post: Pick<BlogPostSerialized, 'status'>): boolean {
  return post.status === 'needs-review' || post.status === 'approved';
}

export function attentionCount(posts: Array<Pick<BlogPostSerialized, 'status'>>): number {
  return posts.filter(needsAttention).length;
}

/** El pendiente MÁS VIEJO que espera atención — el banner lo nombra para que
 *  ningún artículo se quede abandonado detrás de un contador genérico. */
export function attentionSpotlight(
  posts: Array<Pick<BlogPostSerialized, 'id' | 'title' | 'status' | 'updatedAt' | 'createdAt'>>
): { id: string; title: string } | null {
  const pending = posts.filter(needsAttention);
  if (pending.length === 0) return null;
  const oldest = [...pending].sort((a, b) => postSortDate(a).localeCompare(postSortDate(b)))[0];
  return { id: oldest.id, title: oldest.title };
}

/** Una IDEA es un brief que aún no produjo artículo. Cuando el borrador existe,
 *  el brief queda integrado al artículo como su origen y deja de competir como
 *  entidad en la lista. Un `generated` huérfano (sin draftId) sigue siendo idea
 *  visible — jamás se esconde trabajo. */
export function briefIsIdea(
  brief: Pick<BlogBriefSerialized, 'status' | 'generatedDraftId'>
): boolean {
  if (brief.status === 'pending' || brief.status === 'generating') return true;
  return brief.status === 'generated' && !brief.generatedDraftId;
}

export function ideasCount(
  briefs: Array<Pick<BlogBriefSerialized, 'status' | 'generatedDraftId'>>
): number {
  return briefs.filter(briefIsIdea).length;
}

export function filterPosts(
  posts: BlogPostSerialized[],
  opts: { query: string; status: PostFilterStatus; order: SortOrder }
): BlogPostSerialized[] {
  const q = opts.query.trim().toLowerCase();
  const filtered = posts.filter((p) => {
    if (opts.status === 'active' && p.status === 'archived') return false;
    if (opts.status === 'attention' && !needsAttention(p)) return false;
    if (
      opts.status !== 'all' &&
      opts.status !== 'active' &&
      opts.status !== 'attention' &&
      p.status !== opts.status
    ) {
      return false;
    }
    if (q && !p.title.toLowerCase().includes(q)) return false;
    return true;
  });
  return filtered.sort((a, b) => {
    const cmp = postSortDate(b).localeCompare(postSortDate(a));
    return opts.order === 'recent' ? cmp : -cmp;
  });
}

/** `all` = solo IDEAS (briefs sin artículo); `discarded` se consulta a demanda.
 *  Los `generated` con borrador no se listan aquí: viven dentro del artículo. */
export function filterBriefs(
  briefs: BlogBriefSerialized[],
  opts: { query: string; status: BriefFilterStatus; order: SortOrder }
): BlogBriefSerialized[] {
  const q = opts.query.trim().toLowerCase();
  const filtered = briefs.filter((b) => {
    if (opts.status === 'all') {
      if (!briefIsIdea(b)) return false;
    } else if (b.status !== opts.status) {
      return false;
    }
    if (q && !b.topic.toLowerCase().includes(q)) return false;
    return true;
  });
  return filtered.sort((a, b) => {
    const cmp = b.createdAt.localeCompare(a.createdAt);
    return opts.order === 'recent' ? cmp : -cmp;
  });
}

// ── Resumen editorial compacto ───────────────────────────────────────────────

export interface SummarySegment {
  key: 'total' | 'published' | 'draft' | 'review' | 'archived';
  label: string;
  count: number;
  /** Filtro que aplica el segmento al pulsarse (dictamen 2026-08-05). */
  filter: PostFilterStatus;
}

/** «9 artículos · 3 publicados · 3 borradores · 1 en revisión · 2 archivados»
 *  — español consistente y cada estado PULSABLE (aplica su filtro). El total
 *  es el REAL (coincide con el tab); archivados se desglosa solo si existe.
 *  Decisión de Miguel 2026-08-04 (total desglosado) + dictamen 2026-08-05
 *  (segmentos clicables, «artículos» en vez de «posts»). */
export function editorialSummarySegments(
  posts: Array<Pick<BlogPostSerialized, 'status'>>
): SummarySegment[] {
  const count = (s: BlogPostStatus) => posts.filter((p) => p.status === s).length;
  const archived = count('archived');
  const segments: SummarySegment[] = [
    { key: 'total', label: posts.length === 1 ? 'artículo' : 'artículos', count: posts.length, filter: 'all' },
    { key: 'published', label: count('published') === 1 ? 'publicado' : 'publicados', count: count('published'), filter: 'published' },
    { key: 'draft', label: count('draft') === 1 ? 'borrador' : 'borradores', count: count('draft'), filter: 'draft' },
    { key: 'review', label: 'en revisión', count: count('needs-review'), filter: 'needs-review' },
  ];
  if (archived > 0) {
    segments.push({ key: 'archived', label: archived === 1 ? 'archivado' : 'archivados', count: archived, filter: 'archived' });
  }
  return segments;
}
