
export type BlogPostStatus = 'draft' | 'needs-review' | 'approved' | 'published' | 'archived';
export type BlogBriefStatus = 'pending' | 'generating' | 'generated' | 'discarded';
export type BlogCategory = 'arquitectura' | 'automatización' | 'case-study' | 'opinión';

// ── Capa estratégica/editorial (WS2 — SEO integral) ──────────────────────────

export type SearchIntent =
  | 'informational'
  | 'commercial-investigation'
  | 'transactional'
  | 'navigational';

export type FunnelStage = 'awareness' | 'consideration' | 'decision';

export type SourceType =
  | 'official'
  | 'primary-research'
  | 'regulation'
  | 'technical-documentation'
  | 'reputable-secondary'
  | 'pixeltec-evidence';

/** Fuente que respalda un claim del artículo. La verificación es HUMANA
 *  (checkbox consciente), nunca un fetch automático (SSRF). */
export interface PostSource {
  id: string;
  title: string;
  url: string;
  publisher: string;
  sourceType: SourceType;
  /** Qué afirmación concreta del artículo respalda. */
  claimSupported: string;
  /** ISO 8601 — fecha en que se consultó la fuente. */
  accessedAt: string;
  verifiedByHuman: boolean;
}

export interface PostInternalLink {
  targetUrl: string;
  anchor: string;
  placement?: string;
  verified: boolean;
}

/** Trazabilidad editorial. El autor vive en `author.uid` (no se duplica aquí).
 *  Fechas como ISO string (viven en JSONB). */
export interface PostEditorial {
  reviewerId: string | null;
  reviewedAt: string | null;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  changeSummary: string | null;
  aiAssisted: boolean;
  aiDisclosure: string | null;
  claimsVerified: boolean;
  sourcesVerified: boolean;
}

export interface BriefInternalLinkTarget {
  url: string;
  purpose: string;
  suggestedAnchor?: string;
}

/** Estrategia del brief (WS2). Todos opcionales-con-default para
 *  retro-compatibilidad con briefs existentes. */
export interface BriefStrategy {
  userProblem: string;
  searchIntent: SearchIntent | '';
  primaryKeyword: string;
  secondaryKeywords: string[];
  entities: string[];
  contentPillar: string;
  funnelStage: FunnelStage | '';
  contentGoal: string;
  desiredAction: string;
  pixeltecExperience: string[];
  internalLinkTargets: BriefInternalLinkTarget[];
}

export interface BlogBriefDoc extends Partial<BriefStrategy> {
  id: string;
  topic: string;
  angle: string;
  targetAudience: string;
  keyPoints: string[];
  tone: string;
  sources?: PostSource[];
  status: BlogBriefStatus;
  generatedDraftId: string | null;
  createdBy: string;
  createdAt: Date;
}

export interface BlogPostDoc {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category: BlogCategory;
  tags: string[];
  coverImage: string | null;
  author: { name: string; uid: string };

  status: BlogPostStatus;

  briefSource: {
    topic: string;
    angle: string;
    targetAudience: string;
    keyPoints: string[];
    tone: string;
  } & Partial<BriefStrategy>;

  ai: {
    model: string;
    generatedAt: Date;
    editedByHuman: boolean;
    wordsAdded: number;
    iterations: number;
  };

  seo: {
    metaTitle: string;
    metaDescription: string;
    canonicalUrl: string | null;
    noindex: boolean;
    primaryKeyword: string;
    secondaryKeywords: string[];
    searchIntent: SearchIntent | '';
    contentPillar: string;
    /** Alt descriptivo de la portada (OG y <img>); vacío = se usa el título. */
    ogImageAlt: string;
    /** Atribución opcional de la portada (B-PR5, jsonb aditivo — sin
     *  migración): crédito del autor/fuente de la imagen subida. */
    coverAttribution?: string;
  };

  editorial: PostEditorial;
  sources: PostSource[];
  internalLinks: PostInternalLink[];

  wordCount: number;
  readingTimeMin: number;

  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  approvedBy: string | null;
}

// Serializable version for client components (Timestamps → ISO strings)
export interface BlogPostSerialized extends Omit<BlogPostDoc, 'ai' | 'createdAt' | 'updatedAt' | 'publishedAt'> {
  ai: Omit<BlogPostDoc['ai'], 'generatedAt'> & { generatedAt: string };
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface BlogBriefSerialized extends Omit<BlogBriefDoc, 'createdAt'> {
  createdAt: string;
}

/** Defaults canónicos de las capas nuevas — únicos, para que la serialización
 *  NULL-safe y el gate de publicación no dupliquen literales. */
export const EMPTY_EDITORIAL: PostEditorial = {
  reviewerId: null,
  reviewedAt: null,
  lastReviewedAt: null,
  nextReviewAt: null,
  changeSummary: null,
  aiAssisted: false,
  aiDisclosure: null,
  claimsVerified: false,
  sourcesVerified: false,
};

export const EMPTY_SEO: BlogPostDoc['seo'] = {
  metaTitle: '',
  metaDescription: '',
  canonicalUrl: null,
  noindex: true,
  primaryKeyword: '',
  secondaryKeywords: [],
  searchIntent: '',
  contentPillar: '',
  ogImageAlt: '',
};
