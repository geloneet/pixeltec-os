import { getAnthropic, getModel } from './client';
import { BLOG_SYSTEM_PROMPT } from './system-prompt';
import type { BlogBriefDoc } from '../types';

export interface GeneratedPost {
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  coverImage: string | null;
  body: string;
  rawOutput: string;
}

function parseFrontMatter(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return result;

  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();

    if (value.startsWith('[') && value.endsWith(']')) {
      result[key] = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else {
      result[key] = value.replace(/^["']|["']$/g, '');
    }
  }
  return result;
}

function extractBody(raw: string): string {
  // Remove front-matter block, return remaining markdown
  return raw.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
}

export async function generatePostFromBrief(brief: BlogBriefDoc): Promise<GeneratedPost> {
  const client = getAnthropic();
  const model = getModel();

  const userPrompt = `Escribe un artículo de blog para PIXELTEC con la siguiente información:

**Tema:** ${brief.topic}
**Ángulo técnico:** ${brief.angle}
**Audiencia objetivo:** ${brief.targetAudience}
**Puntos clave a cubrir:**
${brief.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}
**Tono:** ${brief.tone}

Sigue el formato de output especificado con front-matter YAML.`;

  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    system: BLOG_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const rawOutput =
    message.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text)
      .join('') ?? '';

  const frontMatter = parseFrontMatter(rawOutput);
  const body = extractBody(rawOutput);

  const allowedCategories = ['arquitectura', 'automatización', 'case-study', 'opinión'];
  const category = allowedCategories.includes(String(frontMatter.category))
    ? String(frontMatter.category)
    : 'arquitectura';

  return {
    title: String(frontMatter.title ?? brief.topic),
    excerpt: String(frontMatter.excerpt ?? '').slice(0, 160),
    category,
    tags: Array.isArray(frontMatter.tags)
      ? (frontMatter.tags as string[]).slice(0, 8)
      : [],
    coverImage: frontMatter.coverImage ? String(frontMatter.coverImage) : null,
    body,
    rawOutput,
  };
}

export function computeWordCount(body: string): number {
  return body.trim().split(/\s+/).filter(Boolean).length;
}

export function computeReadingTime(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 200));
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}
