import type { Timestamp } from 'firebase-admin/firestore';

export type BlogPostStatus = 'draft' | 'needs-review' | 'approved' | 'published' | 'archived';
export type BlogBriefStatus = 'pending' | 'generating' | 'generated' | 'discarded';
export type BlogCategory = 'arquitectura' | 'automatización' | 'case-study' | 'opinión';

export interface BlogBriefDoc {
  id: string;
  topic: string;
  angle: string;
  targetAudience: string;
  keyPoints: string[];
  tone: string;
  status: BlogBriefStatus;
  generatedDraftId: string | null;
  createdBy: string;
  createdAt: Timestamp;
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
  };

  ai: {
    model: string;
    generatedAt: Timestamp;
    editedByHuman: boolean;
    wordsAdded: number;
    iterations: number;
  };

  seo: {
    metaTitle: string;
    metaDescription: string;
    canonicalUrl: string | null;
    noindex: boolean;
  };

  wordCount: number;
  readingTimeMin: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  publishedAt: Timestamp | null;
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
